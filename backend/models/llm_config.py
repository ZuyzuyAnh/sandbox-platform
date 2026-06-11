import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class LLMConfig(Base):
    __tablename__ = "llm_config"

    # Single-row table — always accessed by id="default"
    id: Mapped[str] = mapped_column(String, primary_key=True, default="default")
    provider: Mapped[str] = mapped_column(String, nullable=False, default="azure")
    endpoint_url: Mapped[str] = mapped_column(String, nullable=False, default="")
    api_key: Mapped[str] = mapped_column(String, nullable=False, default="")
    model_name: Mapped[str] = mapped_column(String, nullable=False, default="gpt-5")
    # Azure requires an API version; leave empty for other providers
    api_version: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by_id: Mapped[str | None] = mapped_column(String, nullable=True)
