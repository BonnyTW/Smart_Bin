import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (parent of backend/) when running from backend/
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)
load_dotenv()

from database import init_db_pool, close_db_pool
from routes import bins, readings, alerts, auth
from ws import manager
from scheduler import start_scheduler, scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db_pool()
    start_scheduler()
    yield
    # Shutdown
    scheduler.shutdown()
    await close_db_pool()

app = FastAPI(title="Smart Bin API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bins.router)
app.include_router(readings.router)
app.include_router(alerts.router)
app.include_router(auth.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.websocket("/ws/bins")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from the client, just keep connection open
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
