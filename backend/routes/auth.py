import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
import asyncpg
from uuid import uuid4
from database import get_db
from models import UserRegister, Token, UserOut, RegistrationStatus, PasswordChange
from deps import get_current_user
from password_utils import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_for_development")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.get("/registration-status", response_model=RegistrationStatus)
async def registration_status(conn: asyncpg.Connection = Depends(get_db)):
    admin_count = await conn.fetchval(
        "SELECT COUNT(*)::int FROM users WHERE role = 'admin'"
    )
    return RegistrationStatus(open=admin_count == 0, admin_exists=admin_count > 0)


@router.post("/register", response_model=dict)
async def register(user_data: UserRegister, conn: asyncpg.Connection = Depends(get_db)):
    admin_count = await conn.fetchval(
        "SELECT COUNT(*)::int FROM users WHERE role = 'admin'"
    )
    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin registration is closed. Only one administrator is allowed. Please log in.",
        )

    existing_user = await conn.fetchrow("SELECT id FROM users WHERE email = $1", user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_id = uuid4()
    hashed_password = hash_password(user_data.password)
    
    await conn.execute("""
        INSERT INTO users (id, email, password_hash, role)
        VALUES ($1, $2, $3, 'admin')
    """, new_id, user_data.email, hashed_password)

    return {"message": "Admin account created successfully. You may now log in."}

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), conn: asyncpg.Connection = Depends(get_db)):
    user = await conn.fetchrow("SELECT * FROM users WHERE email = $1", form_data.username)
    if not user or not verify_password(form_data.password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user['email']}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    row = await conn.fetchrow(
        "SELECT password_hash FROM users WHERE id = $1", current_user["id"]
    )
    if not row or not verify_password(data.current_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    await conn.execute(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        hash_password(data.new_password),
        current_user["id"],
    )
    return {"message": "Password updated successfully"}
