"""Celery tasks for sending push notifications."""
import asyncio
from lighting_control.tasks.celery_app import celery


@celery.task(name="lighting_control.tasks.notifications.send_push_notification")
def send_push_notification(title: str, body: str, url: str | None = None):
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_send_push(title, body, url))
    finally:
        loop.close()


async def _send_push(title: str, body: str, url: str | None):
    from lighting_control.db.engine import async_session
    from lighting_control.notifications.service import send_push_to_all
    async with async_session() as db:
        await send_push_to_all(db, title, body, url)
        await db.commit()
