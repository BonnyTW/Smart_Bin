from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from uuid import UUID, uuid4

# --- Bins ---
class BinIn(BaseModel):
    name: str
    location: Optional[str] = None
    max_depth_cm: int
    threshold_pct: int = 80

class BinOut(BaseModel):
    id: UUID
    name: str
    location: Optional[str]
    max_depth_cm: int
    threshold_pct: int
    created_at: datetime

# --- Readings ---
class ReadingIn(BaseModel):
    bin_id: UUID
    fill_pct: float
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    gas_ppm: Optional[float] = None
    moisture_pct: Optional[float] = None

class ReadingOut(BaseModel):
    id: UUID
    bin_id: UUID
    fill_pct: float
    temperature: Optional[float]
    humidity: Optional[float]
    gas_ppm: Optional[float]
    moisture_pct: Optional[float]
    recorded_at: datetime
    fan_on: bool = False

# --- Alerts ---
class AlertOut(BaseModel):
    id: UUID
    bin_id: UUID
    type: str
    message: str
    resolved: bool
    created_at: datetime
    bin_name: Optional[str] = None
    status: str = "active_danger"

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# --- Auth ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    role: str

class RegistrationStatus(BaseModel):
    open: bool
    admin_exists: bool
