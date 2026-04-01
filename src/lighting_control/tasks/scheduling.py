"""Celery tasks for schedule execution."""
import asyncio
import logging
from datetime import datetime, timezone
from lighting_control.tasks.celery_app import celery

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery.task(name="lighting_control.tasks.scheduling.check_cron_schedules")
def check_cron_schedules():
    """Check all enabled cron-triggered schedules and execute any that match the current time."""
    _run_async(_check_cron_schedules_async())


async def _check_cron_schedules_async():
    from croniter import croniter
    from lighting_control.db.engine import async_session
    from lighting_control.schedules.service import get_all_schedules
    from lighting_control.schedules.engine import execute_schedule
    from lighting_control.schedules.models import TriggerType
    now = datetime.now(timezone.utc)
    async with async_session() as db:
        schedules = await get_all_schedules(db)
        for schedule in schedules:
            if not schedule.enabled:
                continue
            for trigger in schedule.triggers:
                if trigger.trigger_type != TriggerType.CRON or not trigger.cron_expression:
                    continue
                try:
                    cron = croniter(trigger.cron_expression, now)
                    prev = cron.get_prev(datetime)
                    if (now - prev).total_seconds() < 35:
                        logger.info(f"Cron trigger matched for schedule '{schedule.name}'")
                        await execute_schedule(db, schedule)
                        break
                except Exception as e:
                    logger.error(f"Cron eval error for schedule '{schedule.name}': {e}")
        await db.commit()


@celery.task(name="lighting_control.tasks.scheduling.recalc_sun_times")
def recalc_sun_times():
    """Recalculate sunrise/sunset times and schedule execution for sun-triggered schedules."""
    _run_async(_recalc_sun_times_async())


async def _recalc_sun_times_async():
    from lighting_control.db.engine import async_session
    from lighting_control.schedules.service import get_all_schedules
    from lighting_control.schedules.engine import execute_schedule
    from lighting_control.schedules.models import TriggerType
    from lighting_control.utils.sun import get_sunrise_sunset, apply_offset
    from lighting_control.auth.models import SystemConfig
    from sqlalchemy import select
    async with async_session() as db:
        lat_row = (await db.execute(select(SystemConfig).where(SystemConfig.key == "location_latitude"))).scalar_one_or_none()
        lon_row = (await db.execute(select(SystemConfig).where(SystemConfig.key == "location_longitude"))).scalar_one_or_none()
        tz_row = (await db.execute(select(SystemConfig).where(SystemConfig.key == "location_timezone"))).scalar_one_or_none()
        if not lat_row or not lon_row or not lat_row.value or not lon_row.value:
            return
        lat = float(lat_row.value)
        lon = float(lon_row.value)
        tz_name = tz_row.value if tz_row else "America/New_York"
        sunrise, sunset = get_sunrise_sunset(lat, lon, tz_name)
        now = datetime.now(timezone.utc)
        schedules = await get_all_schedules(db)
        for schedule in schedules:
            if not schedule.enabled:
                continue
            for trigger in schedule.triggers:
                offset = trigger.offset_minutes or 0
                target_time = None
                if trigger.trigger_type == TriggerType.SUNRISE:
                    target_time = apply_offset(sunrise, offset)
                elif trigger.trigger_type == TriggerType.SUNSET:
                    target_time = apply_offset(sunset, offset)
                else:
                    continue
                if target_time and abs((now - target_time).total_seconds()) < 1830:
                    logger.info(f"Sun trigger matched for schedule '{schedule.name}' (type={trigger.trigger_type.value})")
                    await execute_schedule(db, schedule)
                    break
        await db.commit()
