import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import AsyncSessionLocal, get_db
from dependencies import get_current_user, get_current_user_ws
from models.session import SessionRecord
from models.user import User
from redis_client import get_redis, STREAM_KEY

logger = logging.getLogger(__name__)
router = APIRouter()


async def _user_sandbox_ids(user_id: str, db: AsyncSession) -> set[str]:
    result = await db.execute(select(SessionRecord.id).where(SessionRecord.user_id == user_id))
    return {row[0] for row in result.all()}


@router.get("/api/sandboxes/{sandbox_id}/output")
async def get_sandbox_output(
    sandbox_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        result = await db.execute(
            select(SessionRecord).where(
                SessionRecord.id == sandbox_id,
                SessionRecord.user_id == current_user.id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not your sandbox")

    redis = await get_redis()
    raw = await redis.xrange(STREAM_KEY, "-", "+")
    lines = []
    for _stream_id, fields in raw:
        if fields.get("sandbox_id") != sandbox_id:
            continue
        lines.append({
            "id": fields.get("id", ""),
            "event_type": fields.get("event_type", "output"),
            "message": fields.get("message", ""),
            "timestamp": fields.get("timestamp", ""),
        })
    return {"sandbox_id": sandbox_id, "lines": lines}


@router.get("/api/activity")
async def get_activity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    redis = await get_redis()
    raw = await redis.xrevrange(STREAM_KEY, count=settings.activity_log_max_events)
    events = []

    allowed_ids: set[str] | None = None
    if current_user.role != "admin":
        allowed_ids = await _user_sandbox_ids(current_user.id, db)

    for _stream_id, fields in reversed(raw):
        try:
            if allowed_ids is not None and fields.get("sandbox_id") not in allowed_ids:
                continue
            events.append({k: v for k, v in fields.items()})
        except Exception:
            pass
    return {"events": events}


@router.websocket("/api/events")
async def websocket_events(
    websocket: WebSocket,
    token: str | None = Query(default=None),
):
    await websocket.accept()

    async with AsyncSessionLocal() as db:
        user = await get_current_user_ws(token, db)

    if not user:
        await websocket.close(code=4001)
        return

    is_admin = user.role == "admin"
    user_id = user.id

    redis = await get_redis()
    last_id = "$"
    try:
        while True:
            results = await redis.xread({STREAM_KEY: last_id}, block=1000, count=10)
            if not results:
                continue
            for _stream_name, messages in results:
                for stream_id, fields in messages:
                    last_id = stream_id
                    if not is_admin:
                        async with AsyncSessionLocal() as db:
                            allowed_ids = await _user_sandbox_ids(user_id, db)
                        if fields.get("sandbox_id") not in allowed_ids:
                            continue
                    event = {k: v for k, v in fields.items()}
                    await websocket.send_text(json.dumps(event))
    except WebSocketDisconnect:
        return
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        return
