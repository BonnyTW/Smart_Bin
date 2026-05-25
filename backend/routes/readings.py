import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
import asyncpg
from typing import List
from uuid import uuid4
from database import get_db, DB_POOL
from models import ReadingIn, ReadingOut
from ws import manager
from alert_service import sync_hardware_alerts, GAS_THRESHOLD
from live_cache import set_reading, all_readings

router = APIRouter(tags=["readings"])


async def _persist_reading(new_id, reading_data: ReadingIn):
    if not DB_POOL:
        return
    try:
        async with DB_POOL.acquire() as conn:
            await conn.fetchrow(
                """
                INSERT INTO readings (id, bin_id, fill_pct, temperature, humidity, gas_ppm, moisture_pct)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
                """,
                new_id,
                reading_data.bin_id,
                reading_data.fill_pct,
                reading_data.temperature,
                reading_data.humidity,
                reading_data.gas_ppm,
                reading_data.moisture_pct,
            )
            bin_record = await conn.fetchrow(
                "SELECT threshold_pct, name FROM bins WHERE id = $1", reading_data.bin_id
            )
            if bin_record:
                await sync_hardware_alerts(
                    conn,
                    reading_data.bin_id,
                    reading_data.fill_pct,
                    bin_record["threshold_pct"],
                    reading_data.gas_ppm,
                    bin_record["name"],
                )
    except Exception:
        pass


def compute_fan_on(gas_ppm: float | None, temperature: float | None) -> bool:
    if gas_ppm is not None and gas_ppm >= GAS_THRESHOLD:
        return True
    if temperature is not None and temperature >= 30.0:
        return True
    return False


def _reading_payload(new_id, reading_data: ReadingIn, fan_on: bool, recorded_at: datetime) -> dict:
    return {
        "id": str(new_id),
        "bin_id": str(reading_data.bin_id),
        "fill_pct": reading_data.fill_pct,
        "temperature": reading_data.temperature,
        "humidity": reading_data.humidity,
        "gas_ppm": reading_data.gas_ppm,
        "moisture_pct": reading_data.moisture_pct,
        "recorded_at": recorded_at.isoformat(),
        "fan_on": fan_on,
    }


@router.post("/readings", response_model=ReadingOut)
async def create_reading(reading_data: ReadingIn):
    """Push to UI immediately; save to database in the background."""
    new_id = uuid4()
    now = datetime.now(timezone.utc)
    fan_on = compute_fan_on(reading_data.gas_ppm, reading_data.temperature)
    payload = _reading_payload(new_id, reading_data, fan_on, now)

    set_reading(str(reading_data.bin_id), payload)
    await manager.broadcast({"type": "new_reading", "data": payload})
    asyncio.create_task(_persist_reading(new_id, reading_data))

    return ReadingOut(
        id=new_id,
        bin_id=reading_data.bin_id,
        fill_pct=reading_data.fill_pct,
        temperature=reading_data.temperature,
        humidity=reading_data.humidity,
        gas_ppm=reading_data.gas_ppm,
        moisture_pct=reading_data.moisture_pct,
        recorded_at=now,
        fan_on=fan_on,
    )


@router.get("/live/readings")
async def live_readings():
    """Latest values from memory — no database round-trip."""
    return all_readings()


@router.get("/bins/{bin_id}/history", response_model=List[ReadingOut])
async def get_bin_history(bin_id: str, limit: int = 100, conn: asyncpg.Connection = Depends(get_db)):
    query = """
        SELECT * FROM readings
        WHERE bin_id = $1
        ORDER BY recorded_at DESC
        LIMIT $2
    """
    records = await conn.fetch(query, bin_id, limit)
    result = []
    for r in records:
        d = dict(r)
        d["fan_on"] = compute_fan_on(d.get("gas_ppm"), d.get("temperature"))
        result.append(d)
    return result
