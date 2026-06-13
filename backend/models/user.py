import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="user")  # "user" | "admin"
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Token rate limit — NULL = unlimited (no Redis key created). window NULL = unlimited.
    token_limit: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    token_limit_window_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    # Work role — determines which VS Code sandbox image is used (ba/dev/tester/devops).
    # NULL = use the default vscode_image from config.
    sandbox_role: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
