"""Backup envelope Pydantic schemas."""
from typing import Literal
from pydantic import BaseModel, Field


BACKUP_VERSION = 1


class BackupData(BaseModel):
    devices: list[dict] = Field(default_factory=list)
    hierarchy: dict = Field(default_factory=dict)
    schedules: list[dict] = Field(default_factory=list)
    quick_actions: list[dict] = Field(default_factory=list)
    scenes: list[dict] = Field(default_factory=list)


class BackupEnvelope(BaseModel):
    version: int
    exported_at: str
    app_version: str | None = None
    data: BackupData


class RestoreRequest(BaseModel):
    version: int
    data: BackupData
    mode: Literal["merge", "replace"] = "merge"


class RestoreResponse(BaseModel):
    devices_updated: int
    rooms: dict
    schedules: dict
    quick_actions: dict
    scenes: dict
