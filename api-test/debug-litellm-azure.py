#!/usr/bin/env python3
"""Debug script — calls LiteLLM directly to inspect raw Azure chunks."""
import asyncio
import os
import sys
from pathlib import Path

# Load backend/.env
env_file = Path(__file__).parent.parent / "backend" / ".env"
for line in env_file.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

AZURE_API_KEY  = os.environ.get("AZURE_API_KEY", "")
AZURE_API_BASE = "https://aiworker-1770710959.openai.azure.com/"
AZURE_API_VER  = "2025-01-01-preview"
MODEL_NAME     = "gpt-5"

if not AZURE_API_KEY:
    print("Error: AZURE_API_KEY not set in backend/.env")
    sys.exit(1)

import litellm  # noqa: E402
litellm.suppress_debug_info = True


async def main():
    print(f"Calling azure/{MODEL_NAME} via LiteLLM...\n")
    stream = await litellm.acompletion(
        model=f"azure/{MODEL_NAME}",
        messages=[{"role": "user", "content": "Reply with exactly one word: Hello"}],
        max_tokens=500,
        stream=True,
        api_base=AZURE_API_BASE,
        api_key=AZURE_API_KEY,
        api_version=AZURE_API_VER,
    )

    chunk_count = 0
    print("── Raw chunks from LiteLLM ──────────────────────────")
    async for chunk in stream:
        chunk_count += 1
        choice = chunk.choices[0] if chunk.choices else None
        delta  = choice.delta if choice else None
        content = getattr(delta, "content", None)
        usage   = getattr(chunk, "usage", None)
        print(f"  [{chunk_count}] content={content!r}  finish={getattr(choice, 'finish_reason', None)}  usage={usage}")
        print(f"          full chunk: {chunk}")
        if delta:
            print(f"          delta dict: {delta.__dict__ if hasattr(delta, '__dict__') else delta}")

    print(f"\nTotal chunks: {chunk_count}")
    if chunk_count == 0:
        print("ERROR: No chunks received — stream may be empty or model/endpoint misconfigured")


asyncio.run(main())
