import asyncio
import logging
import uuid
from datetime import datetime, timezone

from redis_client import get_redis, STREAM_KEY
from services.opensandbox_client import fetch_logs
from services.state_poller import get_sandbox, get_all_sandboxes

logger = logging.getLogger(__name__)

_active: set[str] = set()

LOG_POLL_INTERVAL = 10
LIFECYCLE_CHECK_INTERVAL = 3


def classify_line(line: str) -> str:
    s = line.strip()
    if s.startswith("> ") or s.startswith("Thinking"):
        return "thought"
    if any(s.startswith(p) for p in ["Running", "Reading", "Writing", "Executing", "Bash("]):
        return "tool_use"
    if s.startswith("```"):
        return "code"
    if any(s.lower().startswith(p) for p in ["done", "completed", "finished", "created"]):
        return "completed"
    if any(s.lower().startswith(p) for p in ["error", "failed", "exception"]):
        return "error"
    return "output"


def _make_event(sandbox_id: str, event_type: str, message: str, agent: str | None) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "sandbox_id": sandbox_id,
        "event_type": event_type,
        "message": message,
        "agent": agent or "",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def _write_event(event: dict) -> None:
    try:
        redis = await get_redis()
        await redis.xadd(STREAM_KEY, event, maxlen=200)
    except Exception:
        logger.error("Failed to write event to Redis", exc_info=True)


async def _flush_logs(sid: str, agent: str | None, seen_lines: set[str]) -> None:
    try:
        text = await fetch_logs(sid)
        for line in text.splitlines():
            line = line.strip()
            # OpenSandbox returns "(no logs)" literally when the container has no output.
            if not line or line == "(no logs)" or line in seen_lines:
                continue
            seen_lines.add(line)
            await _write_event(_make_event(sid, classify_line(line), line, agent))
    except Exception:
        pass


async def _track_sandbox(sandbox: dict) -> None:
    """Watch a sandbox from start to finish, writing lifecycle + log events."""
    sid = sandbox["id"]
    agent = sandbox.get("agent")
    seen_lines: set[str] = set()

    try:
        await _write_event(_make_event(sid, "started", f"Sandbox {sid} started", agent))

        ticks_since_log = 0
        while True:
            await asyncio.sleep(LIFECYCLE_CHECK_INTERVAL)
            ticks_since_log += LIFECYCLE_CHECK_INTERVAL

            current = get_sandbox(sid)
            if current is None:
                # Sandbox gone from pool — fetch final logs then report completion
                await _flush_logs(sid, agent, seen_lines)
                await _write_event(_make_event(sid, "completed", f"Sandbox {sid} completed", agent))
                return

            if current.get("status") not in ("running", "queued"):
                status = current.get("status", "unknown")
                await _flush_logs(sid, agent, seen_lines)
                event_type = "error" if status in ("error", "failed") else "completed"
                await _write_event(_make_event(sid, event_type, f"Sandbox {sid} {status}", agent))
                return

            # Fetch logs periodically, emit only new lines
            if ticks_since_log >= LOG_POLL_INTERVAL:
                ticks_since_log = 0
                try:
                    text = await fetch_logs(sid)
                    for line in text.splitlines():
                        line = line.strip()
                        if line and line not in seen_lines:
                            seen_lines.add(line)
                            await _write_event(_make_event(sid, classify_line(line), line, agent))
                except Exception:
                    pass  # logs are best-effort; lifecycle tracking continues

    except Exception:
        logger.error("Tracker error for sandbox %s", sid, exc_info=True)
        await _write_event(_make_event(sid, "error", f"Sandbox {sid} tracker error", agent))
    finally:
        _active.discard(sid)


async def consume_loop() -> None:
    while True:
        try:
            for sandbox in get_all_sandboxes():
                sid = sandbox["id"]
                # Skip VSCode sessions — they run `tail -f /dev/null` and produce no
                # meaningful agent output. Only track agent task sandboxes.
                if sandbox.get("agent") is None:
                    continue
                if sandbox.get("status") in ("running", "queued") and sid not in _active:
                    _active.add(sid)
                    asyncio.create_task(_track_sandbox(sandbox))
        except Exception:
            logger.error("SSE consume loop error", exc_info=True)

        await asyncio.sleep(2)
