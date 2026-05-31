import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import AsyncSessionLocal, get_db
from dependencies import get_current_user, get_current_user_ws
from models.group import Group, UserGroup
from models.sandbox import SessionListResponse, SessionResponse
from models.session import SessionRecord
from models.user import User
from services.opensandbox_client import (
    VSCODE_PORT,
    create_vscode_sandbox,
    delete_sandbox,
    fetch_logs,
    get_sandbox_endpoint,
    start_code_server,
    wait_for_code_server,
    wait_for_ready,
)

logger = logging.getLogger(__name__)
router = APIRouter()


async def _merge_user_policies(user_id: str, db: AsyncSession) -> dict | None:
    result = await db.execute(
        select(Group)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == user_id)
    )
    groups = result.scalars().all()
    if not groups:
        logger.info("_merge_user_policies: user %s has no groups", user_id)
        return None
    all_rules: list[dict] = []
    for g in groups:
        policy = g.network_policy or {}
        egress = policy.get("egress", [])
        logger.info("_merge_user_policies: group %r egress=%s", g.name, egress)
        all_rules.extend(egress)
    seen: set[str] = set()
    unique_rules = [r for r in all_rules if not (r["target"] in seen or seen.add(r["target"]))]
    return {"defaultAction": "deny", "egress": unique_rules}


@router.post("/api/sessions", response_model=SessionResponse)
async def create_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    network_policy = await _merge_user_policies(current_user.id, db) if settings.enable_network_policy else None

    try:
        result = await create_vscode_sandbox(
            image=settings.vscode_image,
            timeout=settings.session_ttl_seconds,
            env={},
            metadata={"type": "vscode"},
            network_policy=network_policy,
        )
    except httpx.HTTPStatusError as e:
        logger.error("OpenSandbox create error: %s", e)
        raise HTTPException(status_code=502, detail=f"OpenSandbox error: {e.response.text}")
    except Exception as e:
        logger.error("Unexpected create error: %s", type(e).__name__, exc_info=True)
        raise HTTPException(status_code=502, detail=f"OpenSandbox error: {e}")

    sandbox_id = result.get("id")
    if not sandbox_id:
        raise HTTPException(status_code=502, detail="OpenSandbox returned no sandbox ID")

    logger.info("[%s] Sandbox created, waiting for Running state...", sandbox_id)
    try:
        await wait_for_ready(sandbox_id, timeout_seconds=60)
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Sandbox did not become ready in time")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    logger.info("[%s] Sandbox running, starting code-server...", sandbox_id)
    try:
        await start_code_server(sandbox_id)
        logger.info("[%s] code-server started, waiting for HTTP...", sandbox_id)
        await wait_for_code_server(sandbox_id, timeout_seconds=60)
    except TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="code-server did not start in time. Check sandbox logs and try again.",
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    logger.info("[%s] code-server ready, resolving endpoint...", sandbox_id)
    try:
        session_url = await get_sandbox_endpoint(sandbox_id, VSCODE_PORT)
    except Exception as e:
        logger.error("Failed to get endpoint for %s: %s", sandbox_id, e)
        raise HTTPException(status_code=502, detail=f"Could not resolve endpoint: {e}")

    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=settings.session_ttl_seconds)
    record = SessionRecord(
        id=sandbox_id,
        session_url=session_url,
        status="active",
        created_at=now,
        expires_at=expires,
        user_id=current_user.id,
    )
    db.add(record)
    await db.commit()

    return SessionResponse(
        sandbox_id=sandbox_id,
        session_url=session_url,
        status="active",
        created_at=now.isoformat(),
        expires_at=expires.isoformat(),
    )


@router.get("/api/sessions", response_model=SessionListResponse)
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "admin":
        query = (
            select(SessionRecord, User)
            .join(User, User.id == SessionRecord.user_id, isouter=True)
            .where(SessionRecord.status == "active")
            .order_by(SessionRecord.created_at.desc())
        )
        result = await db.execute(query)
        rows = result.all()
        sessions = [
            SessionResponse(
                sandbox_id=r.id,
                session_url=r.session_url,
                status=r.status,
                created_at=r.created_at.isoformat(),
                expires_at=r.expires_at.isoformat(),
                user_email=u.email if u else None,
            )
            for r, u in rows
        ]
    else:
        query = (
            select(SessionRecord)
            .where(SessionRecord.status == "active", SessionRecord.user_id == current_user.id)
            .order_by(SessionRecord.created_at.desc())
        )
        result = await db.execute(query)
        records = result.scalars().all()
        sessions = [
            SessionResponse(
                sandbox_id=r.id,
                session_url=r.session_url,
                status=r.status,
                created_at=r.created_at.isoformat(),
                expires_at=r.expires_at.isoformat(),
            )
            for r in records
        ]
    return SessionListResponse(sessions=sessions, total=len(sessions))


@router.delete("/api/sessions/{sandbox_id}")
async def terminate_session(
    sandbox_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessionRecord).where(SessionRecord.id == sandbox_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role != "admin" and record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your session")

    record.status = "terminated"
    await db.commit()

    try:
        await delete_sandbox(sandbox_id)
    except httpx.HTTPStatusError as e:
        if e.response.status_code != 404:
            logger.warning("Could not delete sandbox %s: %s", sandbox_id, e)
    except Exception as e:
        logger.warning("Non-fatal error deleting sandbox %s: %s", sandbox_id, e)

    return {"status": "terminated", "sandbox_id": sandbox_id}


@router.get("/api/sessions/{sandbox_id}/logs/stream")
async def stream_session_logs(
    sandbox_id: str,
    token: str | None = Query(default=None),
):
    """SSE endpoint that polls OpenSandbox diagnostics logs and pushes new lines."""
    async with AsyncSessionLocal() as db:
        user = await get_current_user_ws(token, db)
        if user is None:
            return StreamingResponse(
                iter(["data: {\"error\": \"unauthorized\"}\n\n"]),
                media_type="text/event-stream",
                status_code=401,
            )

        if user.role != "admin":
            result = await db.execute(
                select(SessionRecord).where(
                    SessionRecord.id == sandbox_id,
                    SessionRecord.user_id == user.id,
                )
            )
            if result.scalar_one_or_none() is None:
                return StreamingResponse(
                    iter(["data: {\"error\": \"forbidden\"}\n\n"]),
                    media_type="text/event-stream",
                    status_code=403,
                )

    async def log_generator():
        import asyncio
        sent_count = 0
        idle_ticks = 0
        while True:
            try:
                text = await fetch_logs(sandbox_id)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    yield "data: {\"error\": \"sandbox_gone\"}\n\n"
                    return
                await asyncio.sleep(2)
                continue
            except Exception:
                await asyncio.sleep(2)
                continue

            lines = [l.strip() for l in text.splitlines()]
            new_lines = lines[sent_count:]
            new_lines = [l for l in new_lines if l and l != "(no logs)"]

            if new_lines:
                idle_ticks = 0
                ts = datetime.now(timezone.utc).isoformat()
                for line in new_lines:
                    payload = json.dumps({"line": line, "ts": ts})
                    yield f"data: {payload}\n\n"
                sent_count = len(lines)
            else:
                idle_ticks += 1
                if idle_ticks % 5 == 0:
                    yield ": keep-alive\n\n"

            await asyncio.sleep(2)

    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
