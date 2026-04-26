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


async def export_schedules(db: AsyncSession) -> list[dict]:
    """Export schedules for backup. webhook_secret_hash is intentionally omitted (security: secret regenerated on import)."""
    schedules = await get_all_schedules(db)
    out = []
    for s in schedules:
        triggers = [{"trigger_type": t.trigger_type.value, "cron_expression": t.cron_expression, "offset_minutes": t.offset_minutes} for t in s.triggers]
        targets = [{"target_type": tg.target_type.value, "target_id": tg.target_id, "exclude_device_ids": tg.exclude_device_ids, "state": tg.state} for tg in s.targets]
        out.append({"id": s.id, "name": s.name, "enabled": s.enabled, "priority": s.priority, "triggers": triggers, "targets": targets})
    return out


async def import_schedules(db: AsyncSession, items: list[dict], mode: str, created_by: str, id_remap: dict[str, str]) -> dict:
    """Import schedules. mode in {merge, replace}. id_remap maps backup target UUIDs to current-DB UUIDs."""
    if mode == "replace":
        existing = await get_all_schedules(db)
        for s in existing:
            await db.delete(s)
        await db.flush()
    created = 0
    updated = 0
    for item in items:
        backup_id = item.get("id")
        existing = None
        if mode == "merge" and backup_id:
            existing = await get_schedule(db, backup_id)
        if existing:
            existing.name = item["name"]
            existing.enabled = item.get("enabled", True)
            existing.priority = item.get("priority", 0)
            for t in list(existing.triggers):
                await db.delete(t)
            for tg in list(existing.targets):
                await db.delete(tg)
            await db.flush()
            schedule = existing
            updated += 1
        else:
            kwargs = {"name": item["name"], "enabled": item.get("enabled", True), "priority": item.get("priority", 0), "created_by": created_by}
            if backup_id:
                kwargs["id"] = backup_id
            schedule = Schedule(**kwargs)
            db.add(schedule)
            await db.flush()
            created += 1
        for t in item.get("triggers", []):
            trigger_type = TriggerType(t["trigger_type"])
            webhook_secret = None
            if trigger_type == TriggerType.WEBHOOK:
                raw_secret = secrets.token_urlsafe(32)
                webhook_secret = hashlib.sha256(raw_secret.encode()).hexdigest()
            trigger = ScheduleTrigger(schedule_id=schedule.id, trigger_type=trigger_type, cron_expression=t.get("cron_expression"), offset_minutes=t.get("offset_minutes"), webhook_secret_hash=webhook_secret)
            db.add(trigger)
        for tg in item.get("targets", []):
            target_id = tg.get("target_id")
            if target_id and target_id in id_remap:
                target_id = id_remap[target_id]
            excludes = tg.get("exclude_device_ids")
            if excludes:
                excludes = [id_remap.get(eid, eid) for eid in excludes]
            target = ScheduleTarget(schedule_id=schedule.id, target_type=TargetType(tg["target_type"]), target_id=target_id, exclude_device_ids=excludes, state=tg["state"])
            db.add(target)
    await db.flush()
    return {"created": created, "updated": updated}
