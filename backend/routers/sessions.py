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
from models.virtual_key import VirtualKey
from services.opensandbox_client import (
    VSCODE_PORT,
    create_vscode_sandbox,
    delete_sandbox,
    fetch_logs,
    get_sandbox_endpoint,
    run_sandbox_command,
    start_code_server,
    wait_for_code_server,
    wait_for_ready,
)

# Maps each work role to the corresponding VS Code sandbox image built by CuongDV.
# Fallback: settings.vscode_image (used when user has no sandbox_role assigned).
ROLE_IMAGE: dict[str, str] = {
    "ba":     "opensandbox/vscode-claude-ba:latest",
    "dev":    "opensandbox/vscode-claude-dev:latest",
    "tester": "opensandbox/vscode-claude-tester:latest",
    "devops": "opensandbox/vscode-claude-devops:latest",
}

# Installed in every VS Code sandbox so `claude` works out of the box.
# The vscode image has no node/npm, so use the native installer (standalone
# binary into ~/.local/bin), then make sure interactive shells see it.
# Output goes to /tmp/claude-install.log AND the container's stdout
# (/proc/1/fd/1) so it shows up in the session log stream in the UI.
CLAUDE_CODE_INSTALL_CMD = (
    "( echo '=== Installing Claude Code... ==='; "
    "curl -fsSL https://claude.ai/install.sh | bash "
    "&& echo '=== Claude Code install OK ===' "
    "|| echo '=== Claude Code install FAILED ==='; "
    'grep -qs ".local/bin" "$HOME/.bashrc" || '
    "echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> \"$HOME/.bashrc\"; "
    # code-server's default terminal is /bin/sh, which never reads .bashrc —
    # make new terminals use bash so `claude` is on PATH.
    'mkdir -p "$HOME/.local/share/code-server/User"; '
    '[ -f "$HOME/.local/share/code-server/User/settings.json" ] || '
    "echo '{\"terminal.integrated.defaultProfile.linux\": \"bash\"}' "
    '> "$HOME/.local/share/code-server/User/settings.json" '
    ") 2>&1 | tee /tmp/claude-install.log > /proc/1/fd/1"
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

    # Auto-create a virtual key for this session so Claude Code inside the
    # sandbox authenticates against the LLM gateway with zero setup.
    raw_key, key_hash, key_prefix = VirtualKey.generate()
    vk = VirtualKey(
        user_id=current_user.id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        label="vscode-session",
    )
    db.add(vk)
    await db.flush()

    gateway_base_url = (
        settings.sandbox_anthropic_base_url
        or "http://host.docker.internal:8000/api/llmgw"
    )
    sandbox_env = {
        "ANTHROPIC_BASE_URL": gateway_base_url,
        "ANTHROPIC_AUTH_TOKEN": raw_key,
    }

    image = ROLE_IMAGE.get(current_user.sandbox_role or "", settings.vscode_image)

    async def _spawn(img: str):
        return await create_vscode_sandbox(
            image=img,
            timeout=settings.session_ttl_seconds,
            env=sandbox_env,
            metadata={"type": "vscode"},
            network_policy=network_policy,
        )

    try:
        result = await _spawn(image)
    except httpx.HTTPStatusError as e:
        # A role-specific image that hasn't been built/pushed yet must not break
        # the session — degrade gracefully to the default VS Code image.
        if image != settings.vscode_image and "IMAGE_PULL" in e.response.text.upper():
            logger.warning("[role-image] %s unavailable, falling back to %s", image, settings.vscode_image)
            try:
                result = await _spawn(settings.vscode_image)
            except httpx.HTTPStatusError as e2:
                logger.error("OpenSandbox create error (fallback): %s", e2)
                raise HTTPException(status_code=502, detail=f"OpenSandbox error: {e2.response.text}")
        else:
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
        # Best-effort: install Claude Code CLI in the background so it's ready
        # in the integrated terminal. Session creation never fails on this.
        try:
            await run_sandbox_command(sandbox_id, CLAUDE_CODE_INSTALL_CMD)
            logger.info("[%s] Claude Code install started in background", sandbox_id)
        except Exception as e:
            logger.warning("[%s] Claude Code install failed (non-fatal): %s", sandbox_id, e)
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
    vk.label = f"session-{sandbox_id[:12]}"
    record = SessionRecord(
        id=sandbox_id,
        session_url=session_url,
        status="active",
        created_at=now,
        expires_at=expires,
        user_id=current_user.id,
        virtual_key_id=vk.id,
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
    now = datetime.now(timezone.utc)
    if current_user.role == "admin":
        query = (
            select(SessionRecord, User)
            .join(User, User.id == SessionRecord.user_id, isouter=True)
            .where(SessionRecord.status == "active", SessionRecord.expires_at > now)
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
            .where(
                SessionRecord.status == "active",
                SessionRecord.user_id == current_user.id,
                SessionRecord.expires_at > now,
            )
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

    # Revoke the session's auto-created virtual key
    if record.virtual_key_id:
        vk_result = await db.execute(
            select(VirtualKey).where(VirtualKey.id == record.virtual_key_id)
        )
        vk = vk_result.scalar_one_or_none()
        if vk:
            vk.is_active = False

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
