"""Scene API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.auth.dependencies import get_current_user, require_permission
from lighting_control.auth.models import User
from lighting_control.db.engine import get_session
from lighting_control.scenes import schemas, service

router = APIRouter(prefix="/scenes", tags=["scenes"])


@router.get("", response_model=schemas.SceneListResponse)
async def list_scenes(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    custom = await service.get_all_custom_scenes(db)
    return schemas.SceneListResponse(builtin=schemas.BUILTIN_SCENES, custom=[schemas.CustomSceneResponse.model_validate(s) for s in custom])


@router.post("", response_model=schemas.CustomSceneResponse, status_code=status.HTTP_201_CREATED)
async def create_scene(req: schemas.CustomSceneRequest, user: User = Depends(require_permission("can_manage_quick_actions")), db: AsyncSession = Depends(get_session)):
    scene = await service.create_custom_scene(db, req.name, req.color_r, req.color_g, req.color_b, req.color_temp, req.brightness, user.id)
    await db.commit()
    return scene


@router.put("/{scene_id}", response_model=schemas.CustomSceneResponse)
async def update_scene(scene_id: str, req: schemas.CustomSceneRequest, user: User = Depends(require_permission("can_manage_quick_actions")), db: AsyncSession = Depends(get_session)):
    scene = await service.update_custom_scene(db, scene_id, req.name, req.color_r, req.color_g, req.color_b, req.color_temp, req.brightness)
    if not scene:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    await db.commit()
    return scene


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scene(scene_id: str, user: User = Depends(require_permission("can_manage_quick_actions")), db: AsyncSession = Depends(get_session)):
    if not await service.delete_custom_scene(db, scene_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    await db.commit()
