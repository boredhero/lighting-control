"""Push notification business logic."""
import json
import logging
from pywebpush import webpush, WebPushException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.config import settings
from lighting_control.notifications.models import PushSubscription

logger = logging.getLogger(__name__)


async def subscribe(db: AsyncSession, user_id: str, endpoint: str, p256dh_key: str, auth_key: str) -> PushSubscription:
    existing = (await db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id, PushSubscription.endpoint == endpoint))).scalar_one_or_none()
    if existing:
        existing.p256dh_key = p256dh_key
        existing.auth_key = auth_key
        await db.flush()
        return existing
    sub = PushSubscription(user_id=user_id, endpoint=endpoint, p256dh_key=p256dh_key, auth_key=auth_key)
    db.add(sub)
    await db.flush()
    return sub


async def get_all_subscriptions(db: AsyncSession) -> list[PushSubscription]:
    result = await db.execute(select(PushSubscription))
    return list(result.scalars().all())


async def get_user_subscriptions(db: AsyncSession, user_id: str) -> list[PushSubscription]:
    result = await db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id))
    return list(result.scalars().all())


async def send_push_to_all(db: AsyncSession, title: str, body: str, url: str | None = None):
    """Send a push notification to all subscribed users."""
    subs = await get_all_subscriptions(db)
    payload = json.dumps({"title": title, "body": body, "url": url})
    for sub in subs:
        try:
            webpush(subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key}}, data=payload, vapid_private_key=settings.VAPID_PRIVATE_KEY, vapid_claims={"sub": settings.VAPID_CONTACT_EMAIL})
        except WebPushException as e:
            logger.warning(f"Failed to send push to {sub.endpoint}: {e}")
            if "410" in str(e) or "404" in str(e):
                await db.delete(sub)
    await db.flush()
