"""Quick action database models."""
import enum
import uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from lighting_control.db.base import Base


class TargetType(str, enum.Enum):
    DEVICE = "device"
    ROOM = "room"
    ZONE = "zone"
    GROUP = "group"
    ALL = "all"
    ALL_EXCEPT = "all_except"


class QuickAction(Base):
    __tablename__ = "quick_actions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    targets: Mapped[list["QuickActionTarget"]] = relationship("QuickActionTarget", back_populates="quick_action", cascade="all, delete-orphan")


class QuickActionTarget(Base):
    __tablename__ = "quick_action_targets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quick_action_id: Mapped[str] = mapped_column(String(36), ForeignKey("quick_actions.id"), nullable=False)
    target_type: Mapped[TargetType] = mapped_column(Enum(TargetType), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    exclude_device_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    state: Mapped[dict] = mapped_column(JSON, nullable=False)
    quick_action: Mapped["QuickAction"] = relationship("QuickAction", back_populates="targets")
