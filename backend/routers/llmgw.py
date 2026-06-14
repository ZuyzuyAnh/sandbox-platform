"""
LLM Gateway routes — /api/llmgw/*

Endpoints:
  Admin only:
    GET/PUT /api/llmgw/config         — manage LLM backend config

  Authenticated users:
    POST   /api/llmgw/keys            — create a virtual API key
    GET    /api/llmgw/keys            — list own keys (admin: all)
    PATCH  /api/llmgw/keys/{key_id}   — update label / token limit / revoke / reactivate
    DELETE /api/llmgw/keys/{key_id}   — permanently delete a key
    GET    /api/llmgw/usage           — token usage (own; admin: all)
    GET    /api/llmgw/usage/report    — PNG chart report (matplotlib)

  Virtual key auth (used by Claude Code inside sandboxes):
    POST /api/llmgw/v1/messages       — proxy to configured LLM
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, require_admin
from models.guardrail import GuardrailPolicy, KeyGuardrail, UserGuardrail
from models.llm_config import LLMConfig
from models.token_usage import TokenUsage
from models.user import User
from models.virtual_key import VirtualKey
from redis_client import get_redis
from services import guardrails, llmgw_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/llmgw", tags=["llmgw"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LLMConfigResponse(BaseModel):
    provider: str
    endpoint_url: str
    model_name: str
    api_version: str | None
    # api_key intentionally omitted from response


class LLMConfigUpdate(BaseModel):
    provider: str
    endpoint_url: str
    api_key: str
    model_name: str
    api_version: str | None = None


class VirtualKeyCreate(BaseModel):
    label: str | None = None
    token_limit: int | None = None


class VirtualKeyUpdate(BaseModel):
    label: str | None = None
    token_limit: int | None = None
    is_active: bool | None = None


class VirtualKeyResponse(BaseModel):
    id: str
    key_prefix: str
    label: str | None
    is_active: bool
    created_at: str
    user_id: str
    token_limit: int | None = None
    tokens_used: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    request_count: int = 0
    last_used_at: str | None = None
    models: list[str] = []


class VirtualKeyCreated(VirtualKeyResponse):
    # Full key returned only once at creation
    key: str


class TokenUsageResponse(BaseModel):
    id: str
    user_id: str
    virtual_key_id: str
    session_id: str | None
    model: str
    input_tokens: int
    output_tokens: int
    content_input_tokens: int = 0
    content_output_tokens: int = 0
    created_at: str


class GuardrailCreate(BaseModel):
    name: str
    description: str | None = None
    type: str
    config: dict = {}
    enabled: bool = True


class GuardrailUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    config: dict | None = None
    enabled: bool | None = None


class GuardrailResponse(BaseModel):
    id: str
    name: str
    description: str | None
    type: str
    config: dict
    enabled: bool
    created_at: str


class KeyGuardrailUpdate(BaseModel):
    policy_ids: list[str]


# ---------------------------------------------------------------------------
# Admin: LLM config management
# ---------------------------------------------------------------------------

@router.get("/config", response_model=LLMConfigResponse)
async def get_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    config = await llmgw_service.get_llm_config(db)
    return LLMConfigResponse(
        provider=config.provider,
        endpoint_url=config.endpoint_url,
        model_name=config.model_name,
        api_version=config.api_version,
    )


@router.put("/config", response_model=LLMConfigResponse)
async def update_config(
    body: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    config = await llmgw_service.get_llm_config(db)
    config.provider = body.provider
    config.endpoint_url = body.endpoint_url.rstrip("/")
    config.api_key = body.api_key
    config.model_name = body.model_name
    config.api_version = body.api_version
    config.updated_by_id = admin.id
    await db.commit()
    await db.refresh(config)
    return LLMConfigResponse(
        provider=config.provider,
        endpoint_url=config.endpoint_url,
        model_name=config.model_name,
        api_version=config.api_version,
    )


# ---------------------------------------------------------------------------
# Virtual key management
# ---------------------------------------------------------------------------

@router.post("/keys", response_model=VirtualKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_key(
    body: VirtualKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raw_key, key_hash, key_prefix = VirtualKey.generate()
    vk = VirtualKey(
        user_id=current_user.id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        label=body.label,
        token_limit=body.token_limit,
    )
    db.add(vk)
    await db.commit()
    await db.refresh(vk)
    return VirtualKeyCreated(
        id=vk.id,
        key=raw_key,
        key_prefix=vk.key_prefix,
        label=vk.label,
        is_active=vk.is_active,
        created_at=vk.created_at.isoformat(),
        user_id=vk.user_id,
        token_limit=vk.token_limit,
    )


@router.get("/keys", response_model=list[VirtualKeyResponse])
async def list_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        result = await db.execute(select(VirtualKey).order_by(VirtualKey.created_at.desc()))
    else:
        result = await db.execute(
            select(VirtualKey)
            .where(VirtualKey.user_id == current_user.id)
            .order_by(VirtualKey.created_at.desc())
        )
    keys = result.scalars().all()
    stats = await _usage_stats(db)
    return [_key_response(k, stats) for k in keys]


async def _usage_stats(db: AsyncSession) -> dict[str, dict]:
    """Per-key usage aggregates: tokens, request count, last used, models."""
    agg_result = await db.execute(
        select(
            TokenUsage.virtual_key_id,
            func.coalesce(func.sum(TokenUsage.input_tokens), 0),
            func.coalesce(func.sum(TokenUsage.output_tokens), 0),
            func.count(TokenUsage.id),
            func.max(TokenUsage.created_at),
        ).group_by(TokenUsage.virtual_key_id)
    )
    stats: dict[str, dict] = {}
    for key_id, inp, out, count, last in agg_result.all():
        stats[key_id] = {
            "input_tokens": int(inp),
            "output_tokens": int(out),
            "request_count": int(count),
            "last_used_at": last.isoformat() if last else None,
            "models": [],
        }
    models_result = await db.execute(
        select(TokenUsage.virtual_key_id, TokenUsage.model).distinct()
    )
    for key_id, model in models_result.all():
        if key_id in stats:
            stats[key_id]["models"].append(model)
    return stats


def _key_response(vk: VirtualKey, stats: dict[str, dict]) -> VirtualKeyResponse:
    s = stats.get(vk.id, {})
    inp = s.get("input_tokens", 0)
    out = s.get("output_tokens", 0)
    return VirtualKeyResponse(
        id=vk.id, key_prefix=vk.key_prefix, label=vk.label,
        is_active=vk.is_active, created_at=vk.created_at.isoformat(),
        user_id=vk.user_id, token_limit=vk.token_limit,
        tokens_used=inp + out,
        input_tokens=inp,
        output_tokens=out,
        request_count=s.get("request_count", 0),
        last_used_at=s.get("last_used_at"),
        models=sorted(s.get("models", [])),
    )


async def _get_owned_key(key_id: str, current_user: User, db: AsyncSession) -> VirtualKey:
    result = await db.execute(select(VirtualKey).where(VirtualKey.id == key_id))
    vk = result.scalar_one_or_none()
    if not vk:
        raise HTTPException(status_code=404, detail="Key not found")
    if vk.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your key")
    return vk


@router.patch("/keys/{key_id}", response_model=VirtualKeyResponse)
async def update_key(
    key_id: str,
    body: VirtualKeyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vk = await _get_owned_key(key_id, current_user, db)
    fields = body.model_fields_set
    if "label" in fields:
        vk.label = body.label
    if "token_limit" in fields:
        if body.token_limit is not None and body.token_limit < 0:
            raise HTTPException(status_code=422, detail="token_limit must be >= 0")
        vk.token_limit = body.token_limit
    if "is_active" in fields and body.is_active is not None:
        vk.is_active = body.is_active
    await db.commit()
    await db.refresh(vk)
    stats = await _usage_stats(db)
    return _key_response(vk, stats)


@router.delete("/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a key. Usage records are kept for audit."""
    vk = await _get_owned_key(key_id, current_user, db)
    await db.execute(delete(VirtualKey).where(VirtualKey.id == vk.id))
    await db.commit()


# ---------------------------------------------------------------------------
# Token usage
# ---------------------------------------------------------------------------

@router.get("/usage", response_model=list[TokenUsageResponse])
async def get_usage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        result = await db.execute(select(TokenUsage).order_by(TokenUsage.created_at.desc()))
    else:
        result = await db.execute(
            select(TokenUsage)
            .where(TokenUsage.user_id == current_user.id)
            .order_by(TokenUsage.created_at.desc())
        )
    rows = result.scalars().all()
    return [
        TokenUsageResponse(
            id=r.id, user_id=r.user_id, virtual_key_id=r.virtual_key_id,
            session_id=r.session_id, model=r.model,
            input_tokens=r.input_tokens, output_tokens=r.output_tokens,
            content_input_tokens=r.content_input_tokens,
            content_output_tokens=r.content_output_tokens,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.get("/usage/report")
async def usage_report(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Matplotlib chart report as a downloadable PNG (own usage; admin: all)."""
    from services.usage_report import render_usage_report

    days = max(1, min(days, 90))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = select(TokenUsage).where(TokenUsage.created_at >= since)
    if current_user.role != "admin":
        query = query.where(TokenUsage.user_id == current_user.id)
    result = await db.execute(query)
    rows = [
        {
            "created_at": r.created_at,
            "model": r.model,
            "virtual_key_id": r.virtual_key_id,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
        }
        for r in result.scalars().all()
    ]

    keys_result = await db.execute(select(VirtualKey))
    key_labels = {
        k.id: (k.label or k.key_prefix) for k in keys_result.scalars().all()
    }

    png = await asyncio.to_thread(render_usage_report, rows, key_labels, days)
    filename = f"usage-report-{datetime.now(timezone.utc).strftime('%Y%m%d')}.png"
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Guardrails (admin manages policies; any user can view; assigned to keys)
# ---------------------------------------------------------------------------

def _guardrail_response(p: GuardrailPolicy) -> GuardrailResponse:
    return GuardrailResponse(
        id=p.id, name=p.name, description=p.description, type=p.type,
        config=p.config or {}, enabled=p.enabled,
        created_at=p.created_at.isoformat(),
    )


async def _effective_policies(key_id: str, user_id: str, db: AsyncSession) -> list[dict]:
    """
    Enabled guardrail policies that apply to a request — the union of policies
    attached to the virtual key and policies attached to the owning user.
    Deduped (one row per policy) for the checker.
    """
    key_ids = select(KeyGuardrail.policy_id).where(KeyGuardrail.virtual_key_id == key_id)
    user_ids = select(UserGuardrail.policy_id).where(UserGuardrail.user_id == user_id)
    result = await db.execute(
        select(GuardrailPolicy).where(
            GuardrailPolicy.enabled == True,
            or_(GuardrailPolicy.id.in_(key_ids), GuardrailPolicy.id.in_(user_ids)),
        )
    )
    return [
        {"name": p.name, "type": p.type, "config": p.config or {}, "enabled": p.enabled}
        for p in result.scalars().all()
    ]


@router.get("/guardrails", response_model=list[GuardrailResponse])
async def list_guardrails(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(GuardrailPolicy).order_by(GuardrailPolicy.created_at))
    return [_guardrail_response(p) for p in result.scalars().all()]


@router.post("/guardrails", response_model=GuardrailResponse, status_code=status.HTTP_201_CREATED)
async def create_guardrail(
    body: GuardrailCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if body.type not in guardrails.VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"type must be one of {sorted(guardrails.VALID_TYPES)}")
    p = GuardrailPolicy(
        name=body.name, description=body.description, type=body.type,
        config=body.config, enabled=body.enabled,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _guardrail_response(p)


@router.patch("/guardrails/{policy_id}", response_model=GuardrailResponse)
async def update_guardrail(
    policy_id: str,
    body: GuardrailUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(GuardrailPolicy).where(GuardrailPolicy.id == policy_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Guardrail not found")
    fields = body.model_fields_set
    if "name" in fields and body.name is not None:
        p.name = body.name
    if "description" in fields:
        p.description = body.description
    if "config" in fields and body.config is not None:
        p.config = body.config
    if "enabled" in fields and body.enabled is not None:
        p.enabled = body.enabled
    await db.commit()
    await db.refresh(p)
    return _guardrail_response(p)


@router.delete("/guardrails/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guardrail(
    policy_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    await db.execute(delete(KeyGuardrail).where(KeyGuardrail.policy_id == policy_id))
    await db.execute(delete(GuardrailPolicy).where(GuardrailPolicy.id == policy_id))
    await db.commit()


@router.get("/keys/{key_id}/guardrails", response_model=list[str])
async def get_key_guardrails(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_key(key_id, current_user, db)
    result = await db.execute(
        select(KeyGuardrail.policy_id).where(KeyGuardrail.virtual_key_id == key_id)
    )
    return [row[0] for row in result.all()]


@router.put("/keys/{key_id}/guardrails", response_model=list[str])
async def set_key_guardrails(
    key_id: str,
    body: KeyGuardrailUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Replace the set of guardrails attached to a key. Admin only."""
    result = await db.execute(select(VirtualKey).where(VirtualKey.id == key_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Key not found")
    await db.execute(delete(KeyGuardrail).where(KeyGuardrail.virtual_key_id == key_id))
    for pid in dict.fromkeys(body.policy_ids):
        db.add(KeyGuardrail(virtual_key_id=key_id, policy_id=pid))
    await db.commit()
    return list(dict.fromkeys(body.policy_ids))


# ---------------------------------------------------------------------------
# Proxy — virtual key auth (NOT JWT)
# Claude Code inside sandboxes hits this endpoint.
# Auth header: "x-api-key: <virtual-key>"  (Anthropic SDK default)
# Optional session tracking: "x-session-id: <sandbox-session-id>"
# ---------------------------------------------------------------------------

@router.post("/v1/messages")
async def proxy_messages(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    x_session_id: str | None = Header(default=None),
):
    # Extract virtual key from x-api-key or Authorization: Bearer
    raw_key = x_api_key
    if not raw_key:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            raw_key = auth[7:]

    if not raw_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    vk = await llmgw_service.authenticate_virtual_key(raw_key, db)
    if not vk:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")

    # Enforce per-key token limit (total input + output tokens)
    if vk.token_limit is not None:
        used_result = await db.execute(
            select(func.coalesce(func.sum(TokenUsage.input_tokens + TokenUsage.output_tokens), 0))
            .where(TokenUsage.virtual_key_id == vk.id)
        )
        if int(used_result.scalar_one()) >= vk.token_limit:
            raise HTTPException(
                status_code=429,
                detail=f"Token limit exceeded for this key ({vk.token_limit:,} tokens)",
            )

    config = await llmgw_service.get_llm_config(db)
    if not config.endpoint_url or not config.api_key:
        raise HTTPException(status_code=503, detail="LLM gateway not configured — ask an admin to set it up")

    body = await request.json()

    # Enforce guardrails attached to this key or its owning user (before spending tokens)
    policies = await _effective_policies(vk.id, vk.user_id, db)
    if policies:
        prompt = llmgw_service.extract_last_user_text(body)
        violation = guardrails.check_prompt(prompt, policies)
        if violation:
            return StreamingResponse(
                llmgw_service.blocked_sse_stream(violation),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

    redis = await get_redis()
    remaining = await llmgw_service.check_rate_limit(vk.user_id, db, redis)
    if remaining is not None and remaining <= 0:
        return StreamingResponse(
            llmgw_service.no_tokens_sse_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        stream = await llmgw_service.proxy(
            body=body,
            user_id=vk.user_id,
            virtual_key_id=vk.id,
            session_id=x_session_id,
            config=config,
            redis=redis,
        )
    except Exception as e:
        logger.exception("LLM proxy error")
        raise HTTPException(status_code=502, detail=f"LLM backend error: {e}")

    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
