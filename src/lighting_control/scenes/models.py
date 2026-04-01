"""Custom scene database models."""
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from lighting_control.db.base import Base


class CustomScene(Base):
    __tablename__ = "custom_scenes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color_r: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color_g: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color_b: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color_temp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    brightness: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
