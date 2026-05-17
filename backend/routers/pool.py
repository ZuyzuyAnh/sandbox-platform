from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.event import SpawnEvent
from services.state_poller import get_all_sandboxes

router = APIRouter()


@router.get("/api/pool")
async def get_pool():
    sandboxes = get_all_sandboxes()
    running = sum(1 for s in sandboxes if s.get("status") == "running")
    queued = sum(1 for s in sandboxes if s.get("status") == "queued")
    return {
        "sandboxes": sandboxes,
        "total": len(sandboxes),
        "running": running,
        "queued": queued,
    }


@router.get("/api/metrics")
async def get_metrics(db: AsyncSession = Depends(get_db)):
    sandboxes = get_all_sandboxes()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count(SpawnEvent.id)).where(SpawnEvent.spawned_at >= today_start)
    )
    completed_today = result.scalar_one()

    elapsed_values = [s["elapsed_seconds"] for s in sandboxes if s.get("elapsed_seconds") is not None]
    avg_duration = sum(elapsed_values) / len(elapsed_values) if elapsed_values else 0.0

    return {
        "active_count": len(sandboxes),
        "completed_today": completed_today,
        "avg_duration_seconds": avg_duration,
    }
