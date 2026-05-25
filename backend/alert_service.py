import asyncio
from uuid import uuid4
import asyncpg
from database import DB_POOL
from notifications import notify_alert
from ws import manager

GAS_THRESHOLD = 300

ALERT_DEFS = {
    "threshold_exceeded": {
        "danger_title": "Bin nearly full",
        "danger_msg": "Bin is {fill:.0f}% full (limit {limit}%) — needs emptying",
        "resolved_msg": "Fill level OK at {fill:.0f}% (under {limit}% limit)",
    },
    "gas_detected": {
        "danger_title": "High odor",
        "danger_msg": "Gas sensor {gas:.0f} ppm (limit {limit} ppm) — fan running",
        "resolved_msg": "Gas level normal at {gas:.0f} ppm",
    },
}


async def _send_alert_email(alert_type: str, message: str, bin_name: str | None):
    if not DB_POOL:
        return
    try:
        async with DB_POOL.acquire() as conn:
            await notify_alert(conn, alert_type, message, bin_name)
    except Exception:
        pass


async def _get_active_alert(conn, bin_id, alert_type: str):
    return await conn.fetchrow(
        """
        SELECT id, message, resolved FROM alerts
        WHERE bin_id = $1 AND type = $2 AND resolved = false
        ORDER BY created_at DESC LIMIT 1
        """,
        bin_id,
        alert_type,
    )


async def _resolve_alert(conn, alert_id, bin_id, alert_type: str, message: str, bin_name: str | None):
    await conn.execute(
        "UPDATE alerts SET resolved = true, message = $1 WHERE id = $2",
        message,
        alert_id,
    )
    await manager.broadcast({
        "type": "alert_resolved",
        "data": {
            "id": str(alert_id),
            "bin_id": str(bin_id),
            "type": alert_type,
            "message": message,
            "bin_name": bin_name,
        },
    })


async def _raise_alert(
    conn,
    bin_id,
    alert_type: str,
    message: str,
    bin_name: str | None,
    send_email: bool = True,
):
    alert_id = uuid4()
    await conn.execute(
        "INSERT INTO alerts (id, bin_id, type, message) VALUES ($1, $2, $3, $4)",
        alert_id,
        bin_id,
        alert_type,
        message,
    )
    if send_email:
        asyncio.create_task(_send_alert_email(alert_type, message, bin_name))

    await manager.broadcast({
        "type": "new_alert",
        "data": {
            "id": str(alert_id),
            "bin_id": str(bin_id),
            "type": alert_type,
            "message": message,
            "bin_name": bin_name,
            "resolved": False,
        },
    })
    return alert_id


async def _sync_alert_type(
    conn,
    bin_id,
    alert_type: str,
    is_danger: bool,
    danger_message: str,
    resolved_message: str,
    bin_name: str | None,
):
    active = await _get_active_alert(conn, bin_id, alert_type)

    if is_danger:
        if active:
            if active["message"] != danger_message:
                await conn.execute(
                    "UPDATE alerts SET message = $1 WHERE id = $2",
                    danger_message,
                    active["id"],
                )
                await manager.broadcast({
                    "type": "alert_updated",
                    "data": {
                        "id": str(active["id"]),
                        "bin_id": str(bin_id),
                        "type": alert_type,
                        "message": danger_message,
                        "bin_name": bin_name,
                        "resolved": False,
                    },
                })
        else:
            await _raise_alert(conn, bin_id, alert_type, danger_message, bin_name)
    elif active:
        await _resolve_alert(conn, active["id"], bin_id, alert_type, resolved_message, bin_name)


async def sync_hardware_alerts(
    conn: asyncpg.Connection,
    bin_id,
    fill_pct: float,
    threshold_pct: int,
    gas_ppm: float | None,
    bin_name: str | None = None,
):
    """Create danger alerts from live sensor data; auto-resolve when hardware returns to safe."""
    defs = ALERT_DEFS["threshold_exceeded"]
    fill_danger = fill_pct >= threshold_pct
    await _sync_alert_type(
        conn,
        bin_id,
        "threshold_exceeded",
        fill_danger,
        defs["danger_msg"].format(fill=fill_pct, limit=threshold_pct),
        defs["resolved_msg"].format(fill=fill_pct, limit=threshold_pct),
        bin_name,
    )

    defs = ALERT_DEFS["gas_detected"]
    gas_val = gas_ppm or 0
    gas_danger = gas_ppm is not None and gas_ppm >= GAS_THRESHOLD
    await _sync_alert_type(
        conn,
        bin_id,
        "gas_detected",
        gas_danger,
        defs["danger_msg"].format(gas=gas_val, limit=GAS_THRESHOLD),
        defs["resolved_msg"].format(gas=gas_val, limit=GAS_THRESHOLD),
        bin_name,
    )


# Backward-compatible helper used by scheduler
async def create_alert(conn, bin_id, alert_type: str, message: str) -> dict | None:
    bin_row = await conn.fetchrow("SELECT name, threshold_pct FROM bins WHERE id = $1", bin_id)
    if not bin_row:
        return None
    latest = await conn.fetchrow(
        """
        SELECT fill_pct, gas_ppm FROM readings
        WHERE bin_id = $1 ORDER BY recorded_at DESC LIMIT 1
        """,
        bin_id,
    )
    if not latest:
        return None
    await sync_hardware_alerts(
        conn,
        bin_id,
        latest["fill_pct"],
        bin_row["threshold_pct"],
        latest["gas_ppm"],
        bin_row["name"],
    )
    return {"synced": True}
