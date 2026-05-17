from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SpawnEvent(Base):
    __tablename__ = "spawn_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sandbox_id: Mapped[str] = mapped_column(String, nullable=False)
    task: Mapped[str | None] = mapped_column(String, nullable=True)
    agent: Mapped[str | None] = mapped_column(String, nullable=True)
    image: Mapped[str] = mapped_column(String, nullable=False)
    spawned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
