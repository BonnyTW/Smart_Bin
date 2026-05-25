from fastapi import APIRouter, Depends
import asyncpg
from typing import List
from database import get_db
from models import AlertOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/", response_model=List[AlertOut])
async def get_alerts(conn: asyncpg.Connection = Depends(get_db)):
    query = """
        SELECT a.*, b.name AS bin_name
        FROM alerts a
        LEFT JOIN bins b ON b.id = a.bin_id
        ORDER BY a.resolved ASC, a.created_at DESC
    """
    records = await conn.fetch(query)
    result = []
    for r in records:
        d = dict(r)
        d["status"] = "resolved" if d["resolved"] else "active_danger"
        result.append(d)
    return result
