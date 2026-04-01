"""Auth Pydantic schemas for request/response validation."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SetupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)


class SetupStatusResponse(BaseModel):
    setup_complete: bool


class LoginRequest(BaseModel):
    username: str
    password: str


class TOTPVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)
    partial_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    requires_totp: bool = False
    requires_passkey: bool = False
    partial_token: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class GuestCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)
    expires_at: datetime | None = None
    permissions: dict = Field(default_factory=lambda: {"can_control_devices": True, "can_execute_quick_actions": True, "can_manage_quick_actions": False, "can_view_schedules": True, "can_manage_schedules": False, "can_manage_devices": False, "can_manage_users": False})


class InviteCreateRequest(BaseModel):
    expires_at: datetime | None = None


class InviteCreateResponse(BaseModel):
    code: str
    url: str
    expires_at: datetime | None


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)
    invite_code: str


class UserResponse(BaseModel):
    id: str
    username: str
    is_admin: bool
    is_guest: bool
    guest_expires_at: datetime | None
    totp_enabled: bool
    permissions: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TOTPSetupResponse(BaseModel):
    secret: str
    qr_uri: str
    qr_image: str


class APIKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    permissions: dict = Field(default_factory=dict)


class APIKeyCreateResponse(BaseModel):
    id: str
    name: str
    raw_key: str
    created_at: datetime


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=255)


class PasskeyResponse(BaseModel):
    id: str
    name: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
