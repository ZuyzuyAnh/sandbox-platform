import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.event import SpawnEvent
from services.opensandbox_client import create_sandbox

logger = logging.getLogger(__name__)
router = APIRouter()

AGENT_CONFIGS: dict[str, dict | None] = {
    "Claude Code": {
        "image": "opensandbox/code-interpreter:v1.0.2",
        "env_key": "ANTHROPIC_AUTH_TOKEN",
    },
    "OpenAI Codex": None,
    "Qwen Code": None,
}


class SpawnRequest(BaseModel):
    task: str
    agent: str
    image: str


class SpawnResponse(BaseModel):
    sandbox_id: str
    status: str
    message: str


@router.post("/api/spawn", response_model=SpawnResponse)
async def spawn_sandbox(req: SpawnRequest, db: AsyncSession = Depends(get_db)):
    config = AGENT_CONFIGS.get(req.agent)

    if config is None:
        raise HTTPException(
            status_code=400,
            detail=f"{req.agent} is not supported yet. Only Claude Code is available.",
        )

    api_key = settings.anthropic_auth_token
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_AUTH_TOKEN is not configured on the server.",
        )

    # Install CLI as root, create non-root user, run claude as that user.
    # Claude Code refuses --dangerously-skip-permissions when running as root.
    # Write a script as root (embedding full binary path + base64 task), then
    # su to a non-root user to run it — avoids PATH reset and su -m portability.
    import base64
    task_b64 = base64.b64encode(req.task.encode()).decode()
    command = (
        "npm install -g @anthropic-ai/claude-code@latest --quiet && "
        "useradd -m agent 2>/dev/null || true && "
        "CLAUDE_BIN=$(npm prefix -g)/bin/claude && "
        # Write runner script: $1 receives the claude binary path as an argument
        f"printf '#!/bin/sh\\n\"$1\" --dangerously-skip-permissions \"$(echo {task_b64} | base64 -d)\"\\necho \"---FILES---\"\\nfind /home/agent -type f | sort | while read f; do echo \"==== $f ====\"; cat \"$f\"; echo; done\\n' > /tmp/run.sh && "
        "chmod +x /tmp/run.sh && "
        # Outer shell expands $CLAUDE_BIN before passing to su (no PATH needed in agent shell)
        'su agent -c "/tmp/run.sh $CLAUDE_BIN"'
    )

    try:
        result = await create_sandbox(
            image=config["image"],
            timeout=settings.default_sandbox_timeout,
            entrypoint=["/bin/sh", "-c"],
            args=[command],
            env={config["env_key"]: api_key},
            metadata={"agent": req.agent, "task": req.task},
        )
    except httpx.HTTPStatusError as e:
        logger.error("OpenSandbox returned error: %s", e)
        raise HTTPException(status_code=502, detail=f"OpenSandbox error: {e.response.text}")
    except Exception as e:
        logger.error("Unexpected error calling OpenSandbox: %s", type(e).__name__, exc_info=True)
        raise HTTPException(status_code=502, detail=f"OpenSandbox error: {type(e).__name__}: {e}")

    sandbox_id = result.get("id")
    if not sandbox_id:
        raise HTTPException(status_code=502, detail="OpenSandbox returned no sandbox ID")

    try:
        event = SpawnEvent(
            sandbox_id=sandbox_id,
            task=req.task,
            agent=req.agent,
            image=config["image"],
        )
        db.add(event)
        await db.commit()
    except Exception as e:
        logger.error("Database error writing spawn event: %s", e)
        raise HTTPException(status_code=500, detail="Failed to record spawn event")

    return SpawnResponse(
        sandbox_id=sandbox_id,
        status="created",
        message=f"Sandbox {sandbox_id} created — Claude Code is starting",
    )
