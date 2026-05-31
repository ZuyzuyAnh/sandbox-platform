import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_admin
from models.group import Group, UserGroup
from models.session import SessionRecord
from models.user import User
from redis_client import get_redis, STREAM_KEY
from services.opensandbox_client import delete_sandbox

router = APIRouter()


class EgressRule(BaseModel):
    action: str
    target: str


class NetworkPolicy(BaseModel):
    defaultAction: str = "deny"
    egress: list[EgressRule] = []


class CreateGroupRequest(BaseModel):
    name: str
    description: str | None = None
    network_policy: NetworkPolicy = NetworkPolicy()


class UpdateGroupRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class GroupResponse(BaseModel):
    id: str
    name: str
    description: str | None
    network_policy: dict
    member_count: int


class MemberResponse(BaseModel):
    id: str
    email: str
    role: str


class AddMemberRequest(BaseModel):
    user_id: str


async def _group_response(group: Group, db: AsyncSession) -> GroupResponse:
    count_result = await db.execute(
        select(func.count()).where(UserGroup.group_id == group.id)
    )
    member_count = count_result.scalar_one()
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        network_policy=group.network_policy,
        member_count=member_count,
    )


@router.get("/api/groups", response_model=list[GroupResponse])
async def list_groups(
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).order_by(Group.created_at))
    groups = result.scalars().all()
    return [await _group_response(g, db) for g in groups]


@router.post("/api/groups", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    req: CreateGroupRequest,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Group).where(Group.name == req.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Group name already exists")

    group = Group(
        id=str(uuid.uuid4()),
        name=req.name,
        description=req.description,
        network_policy=req.network_policy.model_dump(),
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return await _group_response(group, db)


@router.put("/api/groups/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    req: UpdateGroupRequest,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if req.name is not None:
        if group.name == "default":
            raise HTTPException(status_code=400, detail="Cannot rename the default group")
        group.name = req.name
    if req.description is not None:
        group.description = req.description

    await db.commit()
    await db.refresh(group)
    return await _group_response(group, db)


@router.delete("/api/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.name == "default":
        raise HTTPException(status_code=400, detail="Cannot delete the default group")
    await db.delete(group)
    await db.commit()


@router.get("/api/groups/{group_id}/members", response_model=list[MemberResponse])
async def list_members(
    group_id: str,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")

    result = await db.execute(
        select(User)
        .join(UserGroup, UserGroup.user_id == User.id)
        .where(UserGroup.group_id == group_id)
        .order_by(User.email)
    )
    users = result.scalars().all()
    return [MemberResponse(id=u.id, email=u.email, role=u.role) for u in users]


@router.post("/api/groups/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: str,
    req: AddMemberRequest,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")

    result = await db.execute(select(User).where(User.id == req.user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(UserGroup).where(
            UserGroup.group_id == group_id, UserGroup.user_id == req.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already in group")

    db.add(UserGroup(user_id=req.user_id, group_id=group_id))
    await db.commit()
    return {"status": "added"}


@router.delete("/api/groups/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: str,
    user_id: str,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserGroup).where(
            UserGroup.group_id == group_id, UserGroup.user_id == user_id
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    await db.delete(membership)
    await db.commit()


@router.get("/api/groups/{group_id}/policy", response_model=NetworkPolicy)
async def get_policy(
    group_id: str,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group.network_policy


@router.put("/api/groups/{group_id}/policy", response_model=NetworkPolicy)
async def update_policy(
    group_id: str,
    policy: NetworkPolicy,
    _admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    group.network_policy = policy.model_dump()
    await db.commit()
    await db.refresh(group)

    # Terminate active sessions for all users in this group and notify them.
    user_ids_result = await db.execute(
        select(UserGroup.user_id).where(UserGroup.group_id == group_id)
    )
    affected_user_ids = [row[0] for row in user_ids_result.all()]

    if affected_user_ids:
        sessions_result = await db.execute(
            select(SessionRecord).where(
                SessionRecord.status == "active",
                SessionRecord.user_id.in_(affected_user_ids),
            )
        )
        affected_sessions = sessions_result.scalars().all()

        if affected_sessions:
            redis = await get_redis()
            for record in affected_sessions:
                # Notify the user via WebSocket BEFORE marking terminated,
                # so the sandbox_id is still in their allowed set.
                event = {
                    "id": str(uuid.uuid4()),
                    "sandbox_id": record.id,
                    "event_type": "policy_changed",
                    "message": "Network policy updated — session terminated. Please create a new session.",
                    "agent": "",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                await redis.xadd(STREAM_KEY, event, maxlen=200)
                record.status = "terminated"

            await db.commit()

            for record in affected_sessions:
                try:
                    await delete_sandbox(record.id)
                except Exception:
                    pass

    return group.network_policy
