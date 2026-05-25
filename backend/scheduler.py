from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import DB_POOL
from alert_service import sync_hardware_alerts

async def sync_all_bins_alerts():
    """Backup sync: align alerts with latest stored readings per bin."""
    if not DB_POOL:
        return

    query = """
    SELECT DISTINCT ON (r.bin_id)
        r.bin_id, r.fill_pct, r.gas_ppm, b.threshold_pct, b.name
    FROM readings r
    JOIN bins b ON b.id = r.bin_id
    ORDER BY r.bin_id, r.recorded_at DESC
    """

    async with DB_POOL.acquire() as conn:
        rows = await conn.fetch(query)
        for r in rows:
            await sync_hardware_alerts(
                conn,
                r["bin_id"],
                r["fill_pct"],
                r["threshold_pct"],
                r["gas_ppm"],
                r["name"],
            )

scheduler = AsyncIOScheduler()
scheduler.add_job(sync_all_bins_alerts, "interval", seconds=30)

def start_scheduler():
    scheduler.start()
