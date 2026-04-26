"""Quick action business logic."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from lighting_control.quick_actions.models import QuickAction, QuickActionTarget, TargetType


async def get_all_quick_actions(db: AsyncSession) -> list[QuickAction]:
    result = await db.execute(select(QuickAction).options(selectinload(QuickAction.targets)).order_by(QuickAction.sort_order))
    return list(result.scalars().all())


async def get_quick_action(db: AsyncSession, qa_id: str) -> QuickAction | None:
    result = await db.execute(select(QuickAction).options(selectinload(QuickAction.targets)).where(QuickAction.id == qa_id))
    return result.scalar_one_or_none()


async def create_quick_action(db: AsyncSession, name: str, icon: str | None, targets: list[dict], created_by: str) -> QuickAction:
    qa = QuickAction(name=name, icon=icon, created_by=created_by)
    db.add(qa)
    await db.flush()
    for t in targets:
        target = QuickActionTarget(quick_action_id=qa.id, target_type=TargetType(t["target_type"]), target_id=t.get("target_id"), exclude_device_ids=t.get("exclude_device_ids"), state=t["state"])
        db.add(target)
    await db.flush()
    return await get_quick_action(db, qa.id)


async def update_quick_action(db: AsyncSession, qa_id: str, name: str, icon: str | None, targets: list[dict]) -> QuickAction | None:
    qa = await get_quick_action(db, qa_id)
    if not qa:
        return None
    qa.name = name
    qa.icon = icon
    for t in qa.targets:
        await db.delete(t)
    await db.flush()
    for t in targets:
        target = QuickActionTarget(quick_action_id=qa.id, target_type=TargetType(t["target_type"]), target_id=t.get("target_id"), exclude_device_ids=t.get("exclude_device_ids"), state=t["state"])
        db.add(target)
    await db.flush()
    db.expunge(qa)
    return await get_quick_action(db, qa.id)


async def delete_quick_action(db: AsyncSession, qa_id: str) -> bool:
    qa = await get_quick_action(db, qa_id)
    if qa:
        await db.delete(qa)
        await db.flush()
        return True
    return False


async def reorder_quick_actions(db: AsyncSession, order: list[str]) -> None:
    for i, qa_id in enumerate(order):
        qa = await get_quick_action(db, qa_id)
        if qa:
            qa.sort_order = i
    await db.flush()


async def export_quick_actions(db: AsyncSession) -> list[dict]:
    """Export quick actions for backup."""
    actions = await get_all_quick_actions(db)
    out = []
    for qa in actions:
        targets = [{"target_type": tg.target_type.value, "target_id": tg.target_id, "exclude_device_ids": tg.exclude_device_ids, "state": tg.state} for tg in qa.targets]
        out.append({"id": qa.id, "name": qa.name, "icon": qa.icon, "sort_order": qa.sort_order, "targets": targets})
    return out


async def import_quick_actions(db: AsyncSession, items: list[dict], mode: str, created_by: str, id_remap: dict[str, str]) -> dict:
    """Import quick actions. mode in {merge, replace}. id_remap maps backup target UUIDs to current-DB UUIDs."""
    if mode == "replace":
        existing = await get_all_quick_actions(db)
        for qa in existing:
            await db.delete(qa)
        await db.flush()
    created = 0
    updated = 0
    for item in items:
        if not item.get("targets"):
            raise ValueError(f"Quick action '{item.get('name', '?')}' has no targets — cannot import")
        backup_id = item.get("id")
        existing = None
        if mode == "merge" and backup_id:
            existing = await get_quick_action(db, backup_id)
        if existing:
            existing.name = item["name"]
            existing.icon = item.get("icon")
            existing.sort_order = item.get("sort_order", 0)
            for tg in list(existing.targets):
                await db.delete(tg)
            await db.flush()
            qa = existing
            updated += 1
        else:
            kwargs = {"name": item["name"], "icon": item.get("icon"), "sort_order": item.get("sort_order", 0), "created_by": created_by}
            if backup_id:
                kwargs["id"] = backup_id
            qa = QuickAction(**kwargs)
            db.add(qa)
            await db.flush()
            created += 1
        for tg in item["targets"]:
            target_id = tg.get("target_id")
            if target_id and target_id in id_remap:
                target_id = id_remap[target_id]
            excludes = tg.get("exclude_device_ids")
            if excludes:
                excludes = [id_remap.get(eid, eid) for eid in excludes]
            target = QuickActionTarget(quick_action_id=qa.id, target_type=TargetType(tg["target_type"]), target_id=target_id, exclude_device_ids=excludes, state=tg["state"])
            db.add(target)
    await db.flush()
    return {"created": created, "updated": updated}
