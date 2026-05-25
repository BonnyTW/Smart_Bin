"""
Seed realistic historical data for Smart Bin system.
Simulates 24 hours of gradual bin filling with realistic patterns.
"""
import asyncio
import os
import uuid
import random
from datetime import datetime, timedelta, timezone
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def seed_data():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    # Get all bins
    bins = await conn.fetch("SELECT * FROM bins")
    if not bins:
        print("No bins found! Create a bin first via the Admin page.")
        await conn.close()
        return
    
    # Clear old readings and alerts for a clean start
    await conn.execute("DELETE FROM readings")
    await conn.execute("DELETE FROM alerts")
    print("Cleared old readings and alerts.")

    now = datetime.now(timezone.utc)

    for bin_record in bins:
        bin_id = bin_record['id']
        bin_name = bin_record['name']
        threshold = bin_record['threshold_pct']
        print(f"\nSeeding data for: {bin_name} (ID: {bin_id})")

        # Simulate 24 hours of data, one reading every 10 minutes = 144 readings
        fill = random.uniform(5, 15)  # Start with a mostly empty bin
        base_temp = random.uniform(20, 28)  # Base temperature for the day
        base_humidity = random.uniform(40, 65)

        readings_to_insert = []
        alerts_to_insert = []
        alert_created = False

        for i in range(144):
            timestamp = now - timedelta(minutes=(143 - i) * 10)
            hour_of_day = timestamp.hour

            # Simulate realistic fill pattern:
            # - Faster filling during business hours (8am-6pm)
            # - Slower at night
            # - Occasional small drops (someone compacts trash)
            if 8 <= hour_of_day <= 18:
                fill_increment = random.uniform(0.3, 1.2)  # Faster during day
            elif 6 <= hour_of_day <= 8 or 18 <= hour_of_day <= 22:
                fill_increment = random.uniform(0.1, 0.5)  # Moderate morning/evening
            else:
                fill_increment = random.uniform(0.0, 0.15)  # Almost nothing at night

            # Occasional compaction (slight drop)
            if random.random() < 0.05:
                fill_increment = random.uniform(-3, -1)

            fill += fill_increment
            fill = max(0, min(100, fill))

            # Temperature varies with time of day (cooler at night, warmer midday)
            temp_offset = 4 * (1 - abs(hour_of_day - 14) / 14.0)  # Peak at 2pm
            temperature = base_temp + temp_offset + random.uniform(-0.5, 0.5)
            temperature = round(temperature, 1)

            # Humidity inversely correlated with temperature
            humidity = base_humidity - temp_offset * 2 + random.uniform(-2, 2)
            humidity = round(max(25, min(90, humidity)), 1)

            reading_id = uuid.uuid4()
            readings_to_insert.append((
                reading_id, bin_id, round(fill, 1), temperature, humidity, timestamp
            ))

            # Create alert if threshold crossed and no alert yet
            if fill >= threshold and not alert_created:
                alert_id = uuid.uuid4()
                alerts_to_insert.append((
                    alert_id, bin_id, 'threshold_exceeded',
                    f"Bin fill level ({round(fill, 1)}%) exceeded threshold ({threshold}%)",
                    False, timestamp
                ))
                alert_created = True
                print(f"  Alert triggered at {timestamp.strftime('%H:%M')} — fill: {round(fill, 1)}%")

        # Batch insert readings
        await conn.executemany("""
            INSERT INTO readings (id, bin_id, fill_pct, temperature, humidity, recorded_at)
            VALUES ($1, $2, $3, $4, $5, $6)
        """, readings_to_insert)
        print(f"  Inserted {len(readings_to_insert)} readings")

        # Insert alerts
        if alerts_to_insert:
            await conn.executemany("""
                INSERT INTO alerts (id, bin_id, type, message, resolved, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            """, alerts_to_insert)
            print(f"  Inserted {len(alerts_to_insert)} alerts")

    await conn.close()
    print("\n✓ Seed complete!")

if __name__ == '__main__':
    asyncio.run(seed_data())
