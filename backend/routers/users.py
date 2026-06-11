import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_admin
from models.group import Group, UserGroup
from models.user import User
from services.auth_service import hash_password

router = APIRouter()


class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: str = "user"


class PatchUserRequest(BaseModel):
    role: str | None = None
    is_active: bool | None = None
    token_limit: int | None = None
    token_limit_window_minutes: int | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    groups: list[str]
    token_limit: int | None
    token_limit_window_minutes: int | None


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
    if "token_limit" in req.model_fields_set:
        user.token_limit = req.token_limit
    if "token_limit_window_minutes" in req.model_fields_set:
        user.token_limit_window_minutes = req.token_limit_window_minutes

    await db.commit()
    await db.refresh(user)
    return await _user_with_groups(user, db)


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
