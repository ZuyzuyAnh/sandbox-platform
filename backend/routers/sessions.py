import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.sandbox import SessionListResponse, SessionResponse
from models.session import SessionRecord
from services.opensandbox_client import (
    VSCODE_PORT,
    create_vscode_sandbox,
    delete_sandbox,
    get_sandbox_endpoint,
    start_code_server,
    wait_for_code_server,
    wait_for_ready,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/sessions", response_model=SessionResponse)
async def create_session(db: AsyncSession = Depends(get_db)):
    try:
        result = await create_vscode_sandbox(
            image=settings.vscode_image,
            timeout=settings.session_ttl_seconds,
            env={},
            metadata={"type": "vscode"},
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

    try:
        await wait_for_ready(sandbox_id, timeout_seconds=60)
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Sandbox did not become ready in time")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        await start_code_server(sandbox_id)
        await wait_for_code_server(sandbox_id, timeout_seconds=60)
    except TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="code-server did not start in time. Check sandbox logs and try again.",
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

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
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionRecord)
        .where(SessionRecord.status == "active")
        .order_by(SessionRecord.created_at.desc())
    )
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
async def terminate_session(sandbox_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionRecord).where(SessionRecord.id == sandbox_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Session not found")

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
