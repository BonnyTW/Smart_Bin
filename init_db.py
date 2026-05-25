import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def init_db():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set.")
        return

    # Create connection
    print(f"Connecting to {database_url}...")
    try:
        conn = await asyncpg.connect(database_url)
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    print("Connected. Applying schema.sql...")
    
    with open("schema.sql", "r") as f:
        schema = f.read()

    try:
        await conn.execute(schema)
        print("Schema applied successfully!")
    except Exception as e:
        print(f"Failed to apply schema: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(init_db())
