"""Quick action Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, Field


class QuickActionTargetRequest(BaseModel):
    target_type: str = Field(..., description="device, room, zone, group, all, or all_except")
    target_id: str | None = None
    exclude_device_ids: list[str] | None = None
    state: dict = Field(..., description="setPilot payload for this target")


class QuickActionCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    icon: str | None = None
    targets: list[QuickActionTargetRequest] = Field(..., min_length=1)


class QuickActionUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    icon: str | None = None
    targets: list[QuickActionTargetRequest] = Field(..., min_length=1)


class QuickActionTargetResponse(BaseModel):
    id: str
    target_type: str
    target_id: str | None
    exclude_device_ids: list[str] | None
    state: dict
    class Config:
        from_attributes = True


class QuickActionResponse(BaseModel):
    id: str
    name: str
    icon: str | None
    sort_order: int
    created_by: str
    created_at: datetime
    updated_at: datetime
    targets: list[QuickActionTargetResponse]
    class Config:
        from_attributes = True


class ReorderRequest(BaseModel):
    order: list[str] = Field(..., description="List of quick action IDs in desired order")
