import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import settings
from redis_client import get_redis, STREAM_KEY



logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/sandboxes/{sandbox_id}/output")
async def get_sandbox_output(sandbox_id: str):
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
async def get_activity():
    redis = await get_redis()
    raw = await redis.xrevrange(STREAM_KEY, count=settings.activity_log_max_events)
    events = []
    for _stream_id, fields in reversed(raw):
        try:
            event = {k: v for k, v in fields.items()}
            events.append(event)
        except Exception:
            pass
    return {"events": events}


@router.websocket("/api/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
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
                    event = {k: v for k, v in fields.items()}
                    await websocket.send_text(json.dumps(event))
    except WebSocketDisconnect:
        return
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        return
