from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user
from models.event import SpawnEvent
from models.session import SessionRecord
from models.user import User
from services.state_poller import get_all_sandboxes

router = APIRouter()


@router.get("/api/pool")
async def get_pool(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sandboxes = get_all_sandboxes()

    if current_user.role != "admin":
        # Filter to only sandboxes belonging to the current user
        result = await db.execute(
            select(SessionRecord.id).where(SessionRecord.user_id == current_user.id)
        )
        user_sandbox_ids = {row[0] for row in result.all()}
        sandboxes = [s for s in sandboxes if s["id"] in user_sandbox_ids]

    running = sum(1 for s in sandboxes if s.get("status") == "running")
    queued = sum(1 for s in sandboxes if s.get("status") == "queued")
    return {
        "sandboxes": sandboxes,
        "total": len(sandboxes),
        "running": running,
        "queued": queued,
    }


@router.get("/api/metrics")
async def get_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sandboxes = get_all_sandboxes()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    if current_user.role == "admin":
        result = await db.execute(
            select(func.count(SpawnEvent.id)).where(SpawnEvent.spawned_at >= today_start)
        )
        completed_today = result.scalar_one()
    else:
        user_session_result = await db.execute(
            select(SessionRecord.id).where(SessionRecord.user_id == current_user.id)
        )
        user_sandbox_ids = {row[0] for row in user_session_result.all()}
        sandboxes = [s for s in sandboxes if s["id"] in user_sandbox_ids]
        result = await db.execute(
            select(func.count(SpawnEvent.id)).where(
                SpawnEvent.spawned_at >= today_start,
                SpawnEvent.sandbox_id.in_(user_sandbox_ids),
            )
        )
        completed_today = result.scalar_one()

    elapsed_values = [s["elapsed_seconds"] for s in sandboxes if s.get("elapsed_seconds") is not None]
    avg_duration = sum(elapsed_values) / len(elapsed_values) if elapsed_values else 0.0

    return {
        "active_count": len(sandboxes),
        "completed_today": completed_today,
        "avg_duration_seconds": avg_duration,
    }
