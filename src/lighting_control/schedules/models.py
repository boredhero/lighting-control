"""Schedule database models."""
import enum
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from lighting_control.db.base import Base
from lighting_control.quick_actions.models import TargetType


class TriggerType(str, enum.Enum):
    CRON = "cron"
    SUNRISE = "sunrise"
    SUNSET = "sunset"
    WEBHOOK = "webhook"


class Schedule(Base):
    __tablename__ = "schedules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    triggers: Mapped[list["ScheduleTrigger"]] = relationship("ScheduleTrigger", back_populates="schedule", cascade="all, delete-orphan")
    targets: Mapped[list["ScheduleTarget"]] = relationship("ScheduleTarget", back_populates="schedule", cascade="all, delete-orphan")


class ScheduleTrigger(Base):
    __tablename__ = "schedule_triggers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    schedule_id: Mapped[str] = mapped_column(String(36), ForeignKey("schedules.id"), nullable=False)
    trigger_type: Mapped[TriggerType] = mapped_column(Enum(TriggerType), nullable=False)
    cron_expression: Mapped[str | None] = mapped_column(String(255), nullable=True)
    offset_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    webhook_secret_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    schedule: Mapped["Schedule"] = relationship("Schedule", back_populates="triggers")


class ScheduleTarget(Base):
    __tablename__ = "schedule_targets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    schedule_id: Mapped[str] = mapped_column(String(36), ForeignKey("schedules.id"), nullable=False)
    target_type: Mapped[TargetType] = mapped_column(Enum(TargetType), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    exclude_device_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    state: Mapped[dict] = mapped_column(JSON, nullable=False)
    schedule: Mapped["Schedule"] = relationship("Schedule", back_populates="targets")
