from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import String, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Sandbox(Base):
    __tablename__ = "sandboxes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    image: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    agent: Mapped[str | None] = mapped_column(String, nullable=True)
    task: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)


class SessionResponse(BaseModel):
    sandbox_id: str
    session_url: str
    status: str
    created_at: str
    expires_at: str


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]
    total: int
