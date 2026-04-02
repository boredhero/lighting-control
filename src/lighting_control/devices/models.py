"""Device management database models."""
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from lighting_control.db.base import Base


class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    devices: Mapped[list["Device"]] = relationship("Device", back_populates="room")
    zones: Mapped[list["Zone"]] = relationship("Zone", back_populates="room", cascade="all, delete-orphan")


class Zone(Base):
    __tablename__ = "zones"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.id"), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    room: Mapped["Room"] = relationship("Room", back_populates="zones")
    devices: Mapped[list["Device"]] = relationship("Device", back_populates="zone")


class Group(Base):
    __tablename__ = "groups"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    group_devices: Mapped[list["GroupDevice"]] = relationship("GroupDevice", back_populates="group", cascade="all, delete-orphan")


class GroupDevice(Base):
    __tablename__ = "group_devices"
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("groups.id"), primary_key=True)
    device_id: Mapped[str] = mapped_column(String(36), ForeignKey("devices.id"), primary_key=True)
    group: Mapped["Group"] = relationship("Group", back_populates="group_devices")
    device: Mapped["Device"] = relationship("Device", back_populates="group_memberships")


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mac: Mapped[str] = mapped_column(String(17), unique=True, nullable=False)
    ip: Mapped[str] = mapped_column(String(45), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    module_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bulb_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    room_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("rooms.id"), nullable=True)
    zone_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("zones.id"), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    room: Mapped["Room | None"] = relationship("Room", back_populates="devices")
    zone: Mapped["Zone | None"] = relationship("Zone", back_populates="devices")
    group_memberships: Mapped[list["GroupDevice"]] = relationship("GroupDevice", back_populates="device", cascade="all, delete-orphan")
