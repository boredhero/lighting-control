"""Schedule business logic."""
import hashlib
import secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from lighting_control.quick_actions.models import TargetType
from lighting_control.schedules.models import Schedule, ScheduleTarget, ScheduleTrigger, TriggerType


async def get_all_schedules(db: AsyncSession) -> list[Schedule]:
    result = await db.execute(select(Schedule).options(selectinload(Schedule.triggers), selectinload(Schedule.targets)).order_by(Schedule.priority.desc()))
    return list(result.scalars().all())


async def get_schedule(db: AsyncSession, schedule_id: str) -> Schedule | None:
    result = await db.execute(select(Schedule).options(selectinload(Schedule.triggers), selectinload(Schedule.targets)).where(Schedule.id == schedule_id))
    return result.scalar_one_or_none()


async def create_schedule(db: AsyncSession, name: str, priority: int, triggers: list[dict], targets: list[dict], created_by: str) -> Schedule:
    schedule = Schedule(name=name, priority=priority, created_by=created_by)
    db.add(schedule)
    await db.flush()
    for t in triggers:
        trigger_type = TriggerType(t["trigger_type"])
        webhook_secret = None
        if trigger_type == TriggerType.WEBHOOK:
            raw_secret = secrets.token_urlsafe(32)
            webhook_secret = hashlib.sha256(raw_secret.encode()).hexdigest()
        trigger = ScheduleTrigger(schedule_id=schedule.id, trigger_type=trigger_type, cron_expression=t.get("cron_expression"), offset_minutes=t.get("offset_minutes"), webhook_secret_hash=webhook_secret)
        db.add(trigger)
    for t in targets:
        target = ScheduleTarget(schedule_id=schedule.id, target_type=TargetType(t["target_type"]), target_id=t.get("target_id"), exclude_device_ids=t.get("exclude_device_ids"), state=t["state"])
        db.add(target)
    await db.flush()
    return await get_schedule(db, schedule.id)


async def update_schedule(db: AsyncSession, schedule_id: str, name: str, priority: int, triggers: list[dict], targets: list[dict]) -> Schedule | None:
    schedule = await get_schedule(db, schedule_id)
    if not schedule:
        return None
    schedule.name = name
    schedule.priority = priority
    for t in schedule.triggers:
        await db.delete(t)
    for t in schedule.targets:
        await db.delete(t)
    await db.flush()
    for t in triggers:
        trigger_type = TriggerType(t["trigger_type"])
        webhook_secret = None
        if trigger_type == TriggerType.WEBHOOK:
            raw_secret = secrets.token_urlsafe(32)
            webhook_secret = hashlib.sha256(raw_secret.encode()).hexdigest()
        trigger = ScheduleTrigger(schedule_id=schedule.id, trigger_type=trigger_type, cron_expression=t.get("cron_expression"), offset_minutes=t.get("offset_minutes"), webhook_secret_hash=webhook_secret)
        db.add(trigger)
    for t in targets:
        target = ScheduleTarget(schedule_id=schedule.id, target_type=TargetType(t["target_type"]), target_id=t.get("target_id"), exclude_device_ids=t.get("exclude_device_ids"), state=t["state"])
        db.add(target)
    await db.flush()
    return await get_schedule(db, schedule.id)


async def delete_schedule(db: AsyncSession, schedule_id: str) -> bool:
    schedule = await get_schedule(db, schedule_id)
    if schedule:
        await db.delete(schedule)
        await db.flush()
        return True
    return False


async def set_schedule_enabled(db: AsyncSession, schedule_id: str, enabled: bool) -> Schedule | None:
    schedule = await get_schedule(db, schedule_id)
    if schedule:
        schedule.enabled = enabled
        await db.flush()
    return schedule
