import os
import asyncpg
from typing import AsyncGenerator

DB_POOL: asyncpg.Pool = None

async def init_db_pool():
    global DB_POOL
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")
    
    DB_POOL = await asyncpg.create_pool(database_url)
    print("Database pool initialized.")

async def close_db_pool():
    global DB_POOL
    if DB_POOL:
        await DB_POOL.close()
        print("Database pool closed.")

async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    global DB_POOL
    if not DB_POOL:
        raise RuntimeError("Database pool has not been initialized.")
    async with DB_POOL.acquire() as connection:
        yield connection
