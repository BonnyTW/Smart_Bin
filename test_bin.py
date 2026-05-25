import asyncio
import os
import uuid
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def create_test_bin():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    # Check if a test bin already exists
    record = await conn.fetchrow("SELECT id FROM bins WHERE name = 'Wokwi Test Bin'")
    if record:
        bin_id = record['id']
        print(f"Test bin already exists. BIN_ID: {bin_id}")
    else:
        bin_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO bins (id, name, location, max_depth_cm, threshold_pct) VALUES ($1, $2, $3, $4, $5)",
            bin_id, 'Wokwi Test Bin', 'Virtual Simulator', 100, 80
        )
        print(f"Created new test bin. BIN_ID: {bin_id}")
        
    await conn.close()

if __name__ == '__main__':
    asyncio.run(create_test_bin())
