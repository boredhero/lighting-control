"""Custom scene business logic."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.scenes.models import CustomScene


async def get_all_custom_scenes(db: AsyncSession) -> list[CustomScene]:
    result = await db.execute(select(CustomScene).order_by(CustomScene.name))
    return list(result.scalars().all())


async def get_custom_scene(db: AsyncSession, scene_id: str) -> CustomScene | None:
    result = await db.execute(select(CustomScene).where(CustomScene.id == scene_id))
    return result.scalar_one_or_none()


async def create_custom_scene(db: AsyncSession, name: str, color_r: int | None, color_g: int | None, color_b: int | None, color_temp: int | None, brightness: int, created_by: str) -> CustomScene:
    scene = CustomScene(name=name, color_r=color_r, color_g=color_g, color_b=color_b, color_temp=color_temp, brightness=brightness, created_by=created_by)
    db.add(scene)
    await db.flush()
    return scene


async def update_custom_scene(db: AsyncSession, scene_id: str, name: str, color_r: int | None, color_g: int | None, color_b: int | None, color_temp: int | None, brightness: int) -> CustomScene | None:
    scene = await get_custom_scene(db, scene_id)
    if scene:
        scene.name = name
        scene.color_r = color_r
        scene.color_g = color_g
        scene.color_b = color_b
        scene.color_temp = color_temp
        scene.brightness = brightness
        await db.flush()
    return scene


async def delete_custom_scene(db: AsyncSession, scene_id: str) -> bool:
    scene = await get_custom_scene(db, scene_id)
    if scene:
        await db.delete(scene)
        await db.flush()
        return True
    return False


async def export_scenes(db: AsyncSession) -> list[dict]:
    """Export custom scenes for backup."""
    scenes = await get_all_custom_scenes(db)
    return [{"id": s.id, "name": s.name, "color_r": s.color_r, "color_g": s.color_g, "color_b": s.color_b, "color_temp": s.color_temp, "brightness": s.brightness} for s in scenes]


async def import_scenes(db: AsyncSession, items: list[dict], mode: str, created_by: str) -> dict:
    """Import custom scenes. mode in {merge, replace}."""
    if mode == "replace":
        existing = await get_all_custom_scenes(db)
        for s in existing:
            await db.delete(s)
        await db.flush()
    created = 0
    updated = 0
    for item in items:
        backup_id = item.get("id")
        existing = None
        if mode == "merge" and backup_id:
            existing = await get_custom_scene(db, backup_id)
        if existing:
            existing.name = item["name"]
            existing.color_r = item.get("color_r")
            existing.color_g = item.get("color_g")
            existing.color_b = item.get("color_b")
            existing.color_temp = item.get("color_temp")
            existing.brightness = item.get("brightness", 100)
            updated += 1
        else:
            kwargs = {"name": item["name"], "color_r": item.get("color_r"), "color_g": item.get("color_g"), "color_b": item.get("color_b"), "color_temp": item.get("color_temp"), "brightness": item.get("brightness", 100), "created_by": created_by}
            if backup_id:
                kwargs["id"] = backup_id
            scene = CustomScene(**kwargs)
            db.add(scene)
            created += 1
    await db.flush()
    return {"created": created, "updated": updated}
