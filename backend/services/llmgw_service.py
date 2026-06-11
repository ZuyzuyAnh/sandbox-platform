"""
LLM gateway service — proxies Anthropic-format requests to the configured LLM backend
(Azure OpenAI, OpenAI, Anthropic) via LiteLLM SDK and records token usage.
"""
import json
import logging
import uuid
from collections.abc import AsyncGenerator

import litellm
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models.llm_config import LLMConfig
from models.token_usage import TokenUsage
from models.user import User
from models.virtual_key import VirtualKey

logger = logging.getLogger(__name__)

# Silence litellm's verbose logging
litellm.suppress_debug_info = True
logging.getLogger("LiteLLM").setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

async def get_llm_config(db: AsyncSession) -> LLMConfig:
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == "default"))
    config = result.scalar_one_or_none()
    if not config:
        config = LLMConfig(id="default")
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config


def _litellm_model(config: LLMConfig) -> str:
    return f"{config.provider}/{config.model_name}"


# ---------------------------------------------------------------------------
# Virtual key authentication
# ---------------------------------------------------------------------------

async def authenticate_virtual_key(raw_key: str, db: AsyncSession) -> VirtualKey | None:
    key_hash = VirtualKey.hash_key(raw_key)
    result = await db.execute(
        select(VirtualKey).where(VirtualKey.key_hash == key_hash, VirtualKey.is_active == True)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Token rate limiting
# ---------------------------------------------------------------------------

def _rate_key(user_id: str) -> str:
    return f"ratelimit:{user_id}"


async def check_rate_limit(user_id: str, db: AsyncSession, redis: Redis) -> int | None:
    """
    Returns remaining tokens if limited, or None if unlimited.
    Raises RateLimitExceeded if the user is out of tokens.
    When the Redis key is absent (window expired), refills from DB.
    """
    key = _rate_key(user_id)
    remaining = await redis.get(key)

    if remaining is not None:
        return int(remaining)

    # No Redis key — window expired or first request. Check DB limit.
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or user.token_limit is None or user.token_limit_window_minutes is None:
        return None  # Unlimited

    # Refill: set remaining = full limit, TTL = window. Actual decrement happens after stream.
    ttl = user.token_limit_window_minutes * 60
    await redis.set(key, user.token_limit, ex=ttl)
    return user.token_limit


async def decrement_rate_limit(user_id: str, tokens_used: int, db: AsyncSession, redis: Redis) -> None:
    """Decrement remaining tokens after a successful stream. Clamp at 0."""
    key = _rate_key(user_id)
    remaining = await redis.get(key)
    if remaining is None:
        return  # Window expired mid-stream or user is unlimited — nothing to do

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or user.token_limit is None or user.token_limit_window_minutes is None:
        return  # Became unlimited — nothing to do

    new_remaining = max(0, int(remaining) - tokens_used)
    ttl = await redis.ttl(key)
    if ttl > 0:
        await redis.set(key, new_remaining, ex=ttl)
    else:
        await redis.set(key, new_remaining, ex=user.token_limit_window_minutes * 60)


def no_tokens_sse_stream() -> AsyncGenerator[str, None]:
    """Inject a synthetic Anthropic SSE response telling the user their limit is exhausted."""
    async def _gen():
        message_id = f"msg_{uuid.uuid4().hex[:24]}"
        text = "You have exhausted your token quota for this window. Please contact your administrator."
        yield _sse("message_start", {
            "type": "message_start",
            "message": {
                "id": message_id, "type": "message", "role": "assistant",
                "content": [], "model": "rate-limited",
                "stop_reason": None, "stop_sequence": None,
                "usage": {"input_tokens": 0, "output_tokens": 0},
            },
        })
        yield _sse("ping", {"type": "ping"})
        yield _sse("content_block_start", {
            "type": "content_block_start", "index": 0,
            "content_block": {"type": "text", "text": ""},
        })
        yield _sse("content_block_delta", {
            "type": "content_block_delta", "index": 0,
            "delta": {"type": "text_delta", "text": text},
        })
        yield _sse("content_block_stop", {"type": "content_block_stop", "index": 0})
        yield _sse("message_delta", {
            "type": "message_delta",
            "delta": {"stop_reason": "end_turn", "stop_sequence": None},
            "usage": {"output_tokens": 0},
        })
        yield _sse("message_stop", {"type": "message_stop"})
    return _gen()


# ---------------------------------------------------------------------------
# Anthropic → OpenAI conversion
# ---------------------------------------------------------------------------

def _to_openai_tools(tools: list[dict]) -> list[dict]:
    """Convert Anthropic tools array to OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
            },
        }
        for t in tools
    ]


def _to_openai_tool_choice(tool_choice) -> str | dict | None:
    """Convert Anthropic tool_choice to OpenAI format."""
    if isinstance(tool_choice, str):
        return {"any": "required"}.get(tool_choice, tool_choice)
    if isinstance(tool_choice, dict) and tool_choice.get("type") == "tool":
        return {"type": "function", "function": {"name": tool_choice["name"]}}
    return None


def _to_openai_messages(body: dict) -> list[dict]:
    """Convert Anthropic request body to OpenAI-compatible messages for LiteLLM."""
    messages: list[dict] = []

    system = body.get("system")
    if system:
        if isinstance(system, str):
            messages.append({"role": "system", "content": system})
        elif isinstance(system, list):
            text = " ".join(b.get("text", "") for b in system if b.get("type") == "text")
            if text:
                messages.append({"role": "system", "content": text})

    for msg in body.get("messages", []):
        role = msg["role"]
        content = msg.get("content")

        if isinstance(content, str):
            messages.append({"role": role, "content": content})
            continue

        if not isinstance(content, list):
            continue

        text_blocks = [b for b in content if b.get("type") == "text"]
        tool_use_blocks = [b for b in content if b.get("type") == "tool_use"]
        tool_result_blocks = [b for b in content if b.get("type") == "tool_result"]

        if role == "assistant" and tool_use_blocks:
            # Assistant tool calls → OpenAI tool_calls format
            text = " ".join(b.get("text", "") for b in text_blocks) or None
            messages.append({
                "role": "assistant",
                "content": text,
                "tool_calls": [
                    {
                        "id": tu["id"],
                        "type": "function",
                        "function": {
                            "name": tu["name"],
                            "arguments": json.dumps(tu.get("input", {})),
                        },
                    }
                    for tu in tool_use_blocks
                ],
            })

        elif role == "user" and tool_result_blocks:
            # Tool results → one "tool" role message per result
            for tr in tool_result_blocks:
                tr_content = tr.get("content", "")
                if isinstance(tr_content, list):
                    tr_content = " ".join(
                        b.get("text", "") for b in tr_content if b.get("type") == "text"
                    )
                messages.append({
                    "role": "tool",
                    "tool_call_id": tr["tool_use_id"],
                    "content": tr_content or "",
                })

        else:
            text = " ".join(b.get("text", "") for b in text_blocks)
            messages.append({"role": role, "content": text})

    return messages


# ---------------------------------------------------------------------------
# Streaming response → Anthropic SSE format
# ---------------------------------------------------------------------------

def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def stream_as_anthropic(
    litellm_stream,
    model: str,
    user_id: str,
    virtual_key_id: str,
    session_id: str | None,
    redis: Redis | None = None,
) -> AsyncGenerator[str, None]:
    """
    Convert a LiteLLM streaming response to Anthropic SSE format and record usage.
    Handles text content and tool_use content blocks.
    """
    message_id = f"msg_{uuid.uuid4().hex[:24]}"
    input_tokens = 0
    output_tokens = 0
    stop_reason = "end_turn"

    # Content block tracking — blocks are opened lazily as content arrives
    text_block_index: int | None = None
    tool_blocks: dict[int, int] = {}  # openai tool_call index → anthropic block index
    next_block_index = 0

    yield _sse("message_start", {
        "type": "message_start",
        "message": {
            "id": message_id, "type": "message", "role": "assistant",
            "content": [], "model": model,
            "stop_reason": None, "stop_sequence": None,
            "usage": {"input_tokens": 0, "output_tokens": 0},
        },
    })
    yield _sse("ping", {"type": "ping"})

    async for chunk in litellm_stream:
        choice = chunk.choices[0] if chunk.choices else None
        if not choice:
            continue

        delta = getattr(choice, "delta", None)
        finish_reason = getattr(choice, "finish_reason", None)

        # ── Text content ──────────────────────────────────────────────────
        text_content: str | None = None
        if delta:
            text_content = (
                getattr(delta, "content", None)
                or (delta.get("content") if isinstance(delta, dict) else None)
            )

        if text_content:
            if text_block_index is None:
                text_block_index = next_block_index
                next_block_index += 1
                yield _sse("content_block_start", {
                    "type": "content_block_start", "index": text_block_index,
                    "content_block": {"type": "text", "text": ""},
                })
            yield _sse("content_block_delta", {
                "type": "content_block_delta", "index": text_block_index,
                "delta": {"type": "text_delta", "text": text_content},
            })

        # ── Tool calls ────────────────────────────────────────────────────
        raw_tool_calls = getattr(delta, "tool_calls", None) if delta else None
        if raw_tool_calls:
            for tc in raw_tool_calls:
                tc_index = getattr(tc, "index", 0)
                tc_fn = getattr(tc, "function", None)
                tc_args = getattr(tc_fn, "arguments", None) if tc_fn else None

                if tc_index not in tool_blocks:
                    # First chunk for this tool call — open a new content block
                    anthropic_index = next_block_index
                    tool_blocks[tc_index] = anthropic_index
                    next_block_index += 1
                    yield _sse("content_block_start", {
                        "type": "content_block_start", "index": anthropic_index,
                        "content_block": {
                            "type": "tool_use",
                            "id": getattr(tc, "id", None) or f"toolu_{uuid.uuid4().hex[:24]}",
                            "name": getattr(tc_fn, "name", None) or "",
                            "input": {},
                        },
                    })

                if tc_args:
                    yield _sse("content_block_delta", {
                        "type": "content_block_delta",
                        "index": tool_blocks[tc_index],
                        "delta": {"type": "input_json_delta", "partial_json": tc_args},
                    })

        if finish_reason == "tool_calls":
            stop_reason = "tool_use"

        # Usage arrives on the final chunk (Azure OpenAI with stream_options)
        usage = getattr(chunk, "usage", None)
        if usage:
            input_tokens = getattr(usage, "prompt_tokens", 0) or 0
            output_tokens = getattr(usage, "completion_tokens", 0) or 0

    # Close all open content blocks in index order
    open_indices = sorted(
        ([text_block_index] if text_block_index is not None else [])
        + list(tool_blocks.values())
    )
    for idx in open_indices:
        yield _sse("content_block_stop", {"type": "content_block_stop", "index": idx})

    # Ensure at least one content block was emitted (edge case: empty response)
    if not open_indices:
        yield _sse("content_block_start", {
            "type": "content_block_start", "index": 0,
            "content_block": {"type": "text", "text": ""},
        })
        yield _sse("content_block_stop", {"type": "content_block_stop", "index": 0})

    yield _sse("message_delta", {
        "type": "message_delta",
        "delta": {"stop_reason": stop_reason, "stop_sequence": None},
        "usage": {"output_tokens": output_tokens},
    })

    await _record_usage(user_id, virtual_key_id, session_id, model, input_tokens, output_tokens)

    if redis is not None:
        total_tokens = input_tokens + output_tokens
        async with AsyncSessionLocal() as db:
            await decrement_rate_limit(user_id, total_tokens, db, redis)

    yield _sse("message_stop", {"type": "message_stop"})


async def _record_usage(
    user_id: str,
    virtual_key_id: str,
    session_id: str | None,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> None:
    try:
        async with AsyncSessionLocal() as db:
            db.add(TokenUsage(
                user_id=user_id,
                virtual_key_id=virtual_key_id,
                session_id=session_id,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            ))
            await db.commit()
    except Exception:
        logger.exception("Failed to record token usage")


# ---------------------------------------------------------------------------
# Proxy entrypoint
# ---------------------------------------------------------------------------

async def proxy(
    body: dict,
    user_id: str,
    virtual_key_id: str,
    session_id: str | None,
    config: LLMConfig,
    redis: Redis | None = None,
) -> AsyncGenerator[str, None]:
    """Translate Anthropic-format body, call LiteLLM, stream back as Anthropic SSE."""
    messages = _to_openai_messages(body)
    model = _litellm_model(config)

    kwargs: dict = {
        "model": model,
        "messages": messages,
        "stream": True,
        "api_base": config.endpoint_url,
        "api_key": config.api_key,
        "stream_options": {"include_usage": True},
    }
    if config.api_version:
        kwargs["api_version"] = config.api_version
    if body.get("max_tokens"):
        kwargs["max_tokens"] = body["max_tokens"]
    if body.get("temperature") is not None:
        kwargs["temperature"] = body["temperature"]
    if body.get("tools"):
        kwargs["tools"] = _to_openai_tools(body["tools"])
    if body.get("tool_choice") is not None:
        tc = _to_openai_tool_choice(body["tool_choice"])
        if tc is not None:
            kwargs["tool_choice"] = tc

    litellm_stream = await litellm.acompletion(**kwargs)

    return stream_as_anthropic(
        litellm_stream,
        model=body.get("model", config.model_name),
        user_id=user_id,
        virtual_key_id=virtual_key_id,
        session_id=session_id,
        redis=redis,
    )
