import asyncio
import logging
from datetime import datetime, timezone

from config import settings
from services.opensandbox_client import list_sandboxes

logger = logging.getLogger(__name__)

_sandbox_state: dict[str, dict] = {}
_first_seen: dict[str, datetime] = {}


def get_all_sandboxes() -> list[dict]:
    return list(_sandbox_state.values())


def get_sandbox(sandbox_id: str) -> dict | None:
    return _sandbox_state.get(sandbox_id)


async def poll_loop() -> None:
    while True:
        try:
            sandboxes = await list_sandboxes()
            now = datetime.now(timezone.utc)
            new_state: dict[str, dict] = {}

            for sb in sandboxes:
                sid = sb.get("id", "")
                if not sid:
                    continue

                if sid not in _first_seen:
                    _first_seen[sid] = now

                status_raw = sb.get("status") or {}
                status_str = (
                    status_raw.get("state", "").lower()
                    if isinstance(status_raw, dict)
                    else str(status_raw).lower()
                )
                metrics = sb.get("metrics") or {}
                metadata = sb.get("metadata") or {}
                image_info = sb.get("image") or {}

                new_state[sid] = {
                    "id": sid,
                    "image": image_info.get("uri", ""),
                    "status": status_str,
                    "agent": metadata.get("agent"),
                    "task": metadata.get("task"),
                    "cpu_percent": metrics.get("cpu_percent"),
                    "memory_mb": metrics.get("memory_mb"),
                    "elapsed_seconds": (now - _first_seen[sid]).total_seconds(),
                    "created_at": _first_seen[sid].isoformat(),
                }

            _sandbox_state.clear()
            _sandbox_state.update(new_state)

            for sid in list(_first_seen):
                if sid not in _sandbox_state:
                    del _first_seen[sid]

        except Exception:
            logger.error("State poller error", exc_info=True)

        await asyncio.sleep(settings.poll_interval_seconds)
