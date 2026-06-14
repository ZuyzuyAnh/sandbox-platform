import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class GuardrailPolicy(Base):
    """
    A reusable guardrail rule that can be attached to virtual keys.

    type — one of the built-in checks enforced before proxying a request:
      "blocked_keywords" : config {"keywords": [...]}      block if the prompt contains any
      "pii_block"        : config {}                       block if the prompt contains email/phone
      "max_prompt_chars" : config {"limit": N}             block if the prompt is longer than N chars
    """
    __tablename__ = "guardrail_policies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class KeyGuardrail(Base):
    """Join table — which guardrail policies apply to a virtual key."""
    __tablename__ = "key_guardrails"

    virtual_key_id: Mapped[str] = mapped_column(
        String, ForeignKey("virtual_keys.id", ondelete="CASCADE"), primary_key=True
    )
    policy_id: Mapped[str] = mapped_column(
        String, ForeignKey("guardrail_policies.id", ondelete="CASCADE"), primary_key=True
    )


class UserGuardrail(Base):
    """Join table — guardrail policies applied to all of a user's traffic."""
    __tablename__ = "user_guardrails"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    policy_id: Mapped[str] = mapped_column(
        String, ForeignKey("guardrail_policies.id", ondelete="CASCADE"), primary_key=True
    )
