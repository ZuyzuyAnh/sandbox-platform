import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_admin
from models.chat_message import ChatMessage
from models.group import Group, UserGroup
from models.guardrail import UserGuardrail
from models.session import SessionRecord
from models.token_usage import TokenUsage
from models.user import User
from redis_client import get_redis
from services.auth_service import hash_password
from services.llmgw_service import _rate_key

router = APIRouter()


class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: str = "user"


VALID_SANDBOX_ROLES = {"ba", "dev", "tester", "devops"}


class PatchUserRequest(BaseModel):
    role: str | None = None
    is_active: bool | None = None
    token_limit: int | None = None
    token_limit_window_minutes: int | None = None
    sandbox_role: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    groups: list[str]
    token_limit: int | None
    token_limit_window_minutes: int | None
    sandbox_role: str | None


async def _user_with_groups(user: User, db: AsyncSession) -> UserResponse:
    result = await db.execute(
        select(Group.name)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == user.id)
    )
    group_names = [row[0] for row in result.all()]
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        groups=group_names,
        token_limit=user.token_limit,
        token_limit_window_minutes=user.token_limit_window_minutes,
        sandbox_role=user.sandbox_role,
    )


@router.get("/api/users", response_model=list[UserResponse])
async def list_users(
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return [await _user_with_groups(u, db) for u in users]


@router.post("/api/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    req: CreateUserRequest,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    if req.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="role must be 'user' or 'admin'")

    user = User(
        id=str(uuid.uuid4()),
        email=req.email,
        hashed_password=hash_password(req.password),
        role=req.role,
    )
    db.add(user)

    # Auto-assign to default group
    default_group = await db.execute(select(Group).where(Group.name == "default"))
    default_group = default_group.scalar_one_or_none()
    if default_group:
        db.add(UserGroup(user_id=user.id, group_id=default_group.id))

    await db.commit()
    await db.refresh(user)
    return await _user_with_groups(user, db)


@router.patch("/api/users/{user_id}", response_model=UserResponse)
async def patch_user(
    user_id: str,
    req: PatchUserRequest,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.role is not None:
        if req.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="role must be 'user' or 'admin'")
        user.role = req.role
    if req.is_active is not None:
        user.is_active = req.is_active
    rate_limit_changed = False
    if "token_limit" in req.model_fields_set:
        user.token_limit = req.token_limit
        rate_limit_changed = True
    if "token_limit_window_minutes" in req.model_fields_set:
        user.token_limit_window_minutes = req.token_limit_window_minutes
        rate_limit_changed = True
    if "sandbox_role" in req.model_fields_set:
        if req.sandbox_role is not None and req.sandbox_role not in VALID_SANDBOX_ROLES:
            raise HTTPException(status_code=400, detail=f"sandbox_role must be one of {sorted(VALID_SANDBOX_ROLES)} or null")
        user.sandbox_role = req.sandbox_role

    await db.commit()
    await db.refresh(user)

    if rate_limit_changed:
        redis = await get_redis()
        await redis.delete(_rate_key(user_id))
    return await _user_with_groups(user, db)


class ModelUsage(BaseModel):
    model: str
    tokens: int
    requests: int


class SessionSummary(BaseModel):
    id: str
    status: str
    created_at: str
    expires_at: str
    message_count: int
    tokens: int


class ChatExchange(BaseModel):
    id: str
    session_id: str | None
    model: str
    prompt: str
    response: str
    input_tokens: int
    output_tokens: int
    content_input_tokens: int = 0
    content_output_tokens: int = 0
    created_at: str


class UserOverview(BaseModel):
    user: UserResponse
    total_input: int
    total_output: int
    total_content_input: int
    total_content_output: int
    total_requests: int
    by_model: list[ModelUsage]
    sessions: list[SessionSummary]
    chat: list[ChatExchange]


@router.get("/api/users/{user_id}/overview", response_model=UserOverview)
async def user_overview(
    user_id: str,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Token totals
    totals = await db.execute(
        select(
            func.coalesce(func.sum(TokenUsage.input_tokens), 0),
            func.coalesce(func.sum(TokenUsage.output_tokens), 0),
            func.coalesce(func.sum(TokenUsage.content_input_tokens), 0),
            func.coalesce(func.sum(TokenUsage.content_output_tokens), 0),
            func.count(TokenUsage.id),
        ).where(TokenUsage.user_id == user_id)
    )
    total_in, total_out, total_content_in, total_content_out, total_req = totals.one()

    # Per-model breakdown
    models_result = await db.execute(
        select(
            TokenUsage.model,
            func.coalesce(func.sum(TokenUsage.input_tokens + TokenUsage.output_tokens), 0),
            func.count(TokenUsage.id),
        )
        .where(TokenUsage.user_id == user_id)
        .group_by(TokenUsage.model)
    )
    by_model = [
        ModelUsage(model=m, tokens=int(tok), requests=int(req))
        for m, tok, req in models_result.all()
    ]
    by_model.sort(key=lambda x: x.tokens, reverse=True)

    # Chat history (most recent first, capped)
    chat_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(500)
    )
    chat_rows = chat_result.scalars().all()
    chat = [
        ChatExchange(
            id=c.id, session_id=c.session_id, model=c.model,
            prompt=c.prompt, response=c.response,
            input_tokens=c.input_tokens, output_tokens=c.output_tokens,
            content_input_tokens=c.content_input_tokens,
            content_output_tokens=c.content_output_tokens,
            created_at=c.created_at.isoformat(),
        )
        for c in chat_rows
    ]

    # Per-session message/token counts from chat history
    sess_msgs: dict[str | None, dict] = {}
    for c in chat_rows:
        agg = sess_msgs.setdefault(c.session_id, {"count": 0, "tokens": 0})
        agg["count"] += 1
        agg["tokens"] += c.input_tokens + c.output_tokens

    sessions_result = await db.execute(
        select(SessionRecord)
        .where(SessionRecord.user_id == user_id)
        .order_by(SessionRecord.created_at.desc())
    )
    sessions = [
        SessionSummary(
            id=s.id, status=s.status,
            created_at=s.created_at.isoformat(),
            expires_at=s.expires_at.isoformat(),
            message_count=sess_msgs.get(s.id, {}).get("count", 0),
            tokens=sess_msgs.get(s.id, {}).get("tokens", 0),
        )
        for s in sessions_result.scalars().all()
    ]

    return UserOverview(
        user=await _user_with_groups(user, db),
        total_input=int(total_in),
        total_output=int(total_out),
        total_content_input=int(total_content_in),
        total_content_output=int(total_content_out),
        total_requests=int(total_req),
        by_model=by_model,
        sessions=sessions,
        chat=chat,
    )


class UserGuardrailUpdate(BaseModel):
    policy_ids: list[str]


@router.get("/api/users/{user_id}/guardrails", response_model=list[str])
async def get_user_guardrails(
    user_id: str,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserGuardrail.policy_id).where(UserGuardrail.user_id == user_id)
    )
    return [row[0] for row in result.all()]


@router.put("/api/users/{user_id}/guardrails", response_model=list[str])
async def set_user_guardrails(
    user_id: str,
    req: UserGuardrailUpdate,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")
    await db.execute(delete(UserGuardrail).where(UserGuardrail.user_id == user_id))
    for pid in dict.fromkeys(req.policy_ids):
        db.add(UserGuardrail(user_id=user_id, policy_id=pid))
    await db.commit()
    return list(dict.fromkeys(req.policy_ids))


@router.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
