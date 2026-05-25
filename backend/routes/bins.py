from fastapi import APIRouter, Depends, HTTPException
import asyncpg
from typing import List
from uuid import uuid4
from database import get_db
from models import BinIn, BinOut
from deps import get_current_user

router = APIRouter(prefix="/bins", tags=["bins"])

@router.get("/", response_model=List[BinOut])
async def get_bins(conn: asyncpg.Connection = Depends(get_db)):
    query = "SELECT * FROM bins"
    records = await conn.fetch(query)
    return [dict(r) for r in records]

@router.get("/{bin_id}", response_model=BinOut)
async def get_bin(bin_id: str, conn: asyncpg.Connection = Depends(get_db)):
    query = "SELECT * FROM bins WHERE id = $1"
    record = await conn.fetchrow(query, bin_id)
    if not record:
        raise HTTPException(status_code=404, detail="Bin not found")
    return dict(record)

@router.post("/", response_model=BinOut)
async def create_bin(
    bin_data: BinIn,
    conn: asyncpg.Connection = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    new_id = uuid4()
    query = """
        INSERT INTO bins (id, name, location, max_depth_cm, threshold_pct)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    """
    record = await conn.fetchrow(query, new_id, bin_data.name, bin_data.location, bin_data.max_depth_cm, bin_data.threshold_pct)
    return dict(record)

@router.delete("/{bin_id}")
async def delete_bin(bin_id: str, conn: asyncpg.Connection = Depends(get_db)):
    query = "DELETE FROM bins WHERE id = $1 RETURNING id"
    record = await conn.fetchrow(query, bin_id)
    if not record:
        raise HTTPException(status_code=404, detail="Bin not found")
    return {"detail": "Bin deleted successfully"}
