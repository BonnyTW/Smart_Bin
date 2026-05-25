import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def migrate():
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    
    migrations = [
        "ALTER TABLE readings ADD COLUMN IF NOT EXISTS gas_ppm FLOAT",
        "ALTER TABLE readings ADD COLUMN IF NOT EXISTS moisture_pct FLOAT",
    ]
    
    for sql in migrations:
        try:
            await conn.execute(sql)
            print(f"OK: {sql}")
        except Exception as e:
            print(f"SKIP: {e}")
    
    await conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
