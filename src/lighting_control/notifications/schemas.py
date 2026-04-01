"""Push notification Pydantic schemas."""
from pydantic import BaseModel


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    p256dh_key: str
    auth_key: str


class VAPIDPublicKeyResponse(BaseModel):
    public_key: str
