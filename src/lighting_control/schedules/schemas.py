"""Schedule Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ScheduleTriggerRequest(BaseModel):
    trigger_type: str = Field(..., description="cron, sunrise, sunset, or webhook")
    cron_expression: str | None = None
    offset_minutes: int | None = Field(None, ge=-60, le=60)


class ScheduleTargetRequest(BaseModel):
    target_type: str = Field(..., description="device, room, zone, group, all, or all_except")
    target_id: str | None = None
    exclude_device_ids: list[str] | None = None
    state: dict = Field(..., description="setPilot payload for this target")


class ScheduleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    priority: int = Field(0, ge=0, le=100)
    triggers: list[ScheduleTriggerRequest] = Field(..., min_length=1)
    targets: list[ScheduleTargetRequest] = Field(..., min_length=1)


class ScheduleUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    priority: int = Field(0, ge=0, le=100)
    triggers: list[ScheduleTriggerRequest] = Field(..., min_length=1)
    targets: list[ScheduleTargetRequest] = Field(..., min_length=1)


class ScheduleTriggerResponse(BaseModel):
    id: str
    trigger_type: str
    cron_expression: str | None
    offset_minutes: int | None
    webhook_url: str | None = None
    model_config = ConfigDict(from_attributes=True)


class ScheduleTargetResponse(BaseModel):
    id: str
    target_type: str
    target_id: str | None
    exclude_device_ids: list[str] | None
    state: dict
    model_config = ConfigDict(from_attributes=True)


class ScheduleResponse(BaseModel):
    id: str
    name: str
    enabled: bool
    priority: int
    created_by: str
    created_at: datetime
    updated_at: datetime
    triggers: list[ScheduleTriggerResponse]
    targets: list[ScheduleTargetResponse]
    model_config = ConfigDict(from_attributes=True)


class LocationSettings(BaseModel):
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    timezone: str = "America/New_York"
