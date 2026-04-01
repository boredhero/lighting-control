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
