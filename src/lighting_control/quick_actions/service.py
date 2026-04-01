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
