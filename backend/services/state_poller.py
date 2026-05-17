import asyncio
import logging
from datetime import datetime, timezone

from config import settings
from services.opensandbox_client import get_sandbox_metrics, list_sandboxes

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

            running_ids: list[str] = []

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
                metadata = sb.get("metadata") or {}
                image_info = sb.get("image") or {}

                new_state[sid] = {
                    "id": sid,
                    "image": image_info.get("uri", ""),
                    "status": status_str,
                    "agent": metadata.get("agent"),
                    "task": metadata.get("task"),
                    "cpu_percent": None,
                    "memory_mb": None,
                    "elapsed_seconds": (now - _first_seen[sid]).total_seconds(),
                    "created_at": _first_seen[sid].isoformat(),
                }
                if status_str == "running":
                    running_ids.append(sid)

            if running_ids:
                metrics_results = await asyncio.gather(
                    *[get_sandbox_metrics(sid) for sid in running_ids],
                    return_exceptions=True,
                )
                for sid, result in zip(running_ids, metrics_results):
                    if isinstance(result, dict):
                        new_state[sid]["cpu_percent"] = result.get("cpu_percent")
                        new_state[sid]["memory_mb"] = result.get("memory_mb")

            _sandbox_state.clear()
            _sandbox_state.update(new_state)

            for sid in list(_first_seen):
                if sid not in _sandbox_state:
                    del _first_seen[sid]

        except Exception:
            logger.error("State poller error", exc_info=True)

        await asyncio.sleep(settings.poll_interval_seconds)
