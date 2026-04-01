"""Push notification API endpoints."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.auth.dependencies import get_current_user
from lighting_control.auth.models import User
from lighting_control.config import settings
from lighting_control.db.engine import get_session
from lighting_control.notifications import schemas, service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/vapid-public-key", response_model=schemas.VAPIDPublicKeyResponse)
async def get_vapid_key(user: User = Depends(get_current_user)):
    return schemas.VAPIDPublicKeyResponse(public_key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_push(req: schemas.PushSubscriptionRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    await service.subscribe(db, user.id, req.endpoint, req.p256dh_key, req.auth_key)
    await db.commit()
    return {"subscribed": True}
