"""Device Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, Field


class DeviceResponse(BaseModel):
    id: str
    mac: str
    ip: str
    name: str
    model: str | None
    module_name: str | None
    bulb_type: str | None
    firmware_version: str | None
    room_id: str | None
    zone_id: str | None
    last_seen: datetime | None
    is_online: bool
    last_state: dict | None
    created_at: datetime
    class Config:
        from_attributes = True


class DeviceControlRequest(BaseModel):
    state: dict = Field(..., description="setPilot payload: scene, r/g/b, c/w, dimming, temp, etc.")


class BulkControlRequest(BaseModel):
    device_ids: list[str]
    state: dict


class DeviceRenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class DeviceAssignRequest(BaseModel):
    room_id: str | None = None
    zone_id: str | None = None


class RoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    icon: str | None = None


class RoomResponse(BaseModel):
    id: str
    name: str
    icon: str | None
    sort_order: int
    created_at: datetime
    class Config:
        from_attributes = True


class ZoneRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    icon: str | None = None


class ZoneResponse(BaseModel):
    id: str
    name: str
    icon: str | None
    sort_order: int
    created_at: datetime
    class Config:
        from_attributes = True


class GroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    icon: str | None = None
    device_ids: list[str] = Field(default_factory=list)


class GroupResponse(BaseModel):
    id: str
    name: str
    icon: str | None
    sort_order: int
    device_ids: list[str]
    created_at: datetime
    class Config:
        from_attributes = True
