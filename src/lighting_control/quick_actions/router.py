"""Quick action API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.auth.dependencies import get_current_user, require_permission
from lighting_control.auth.models import User
from lighting_control.db.engine import get_session
from lighting_control.devices.discovery import control_device
from lighting_control.devices.service import get_device, resolve_device_ids
from lighting_control.quick_actions import schemas, service

router = APIRouter(prefix="/quick-actions", tags=["quick-actions"])


@router.get("", response_model=list[schemas.QuickActionResponse])
async def list_quick_actions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    return await service.get_all_quick_actions(db)


@router.get("/{qa_id}", response_model=schemas.QuickActionResponse)
async def get_quick_action(qa_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    qa = await service.get_quick_action(db, qa_id)
    if not qa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quick action not found")
    return qa


@router.post("", response_model=schemas.QuickActionResponse, status_code=status.HTTP_201_CREATED)
async def create_quick_action(req: schemas.QuickActionCreateRequest, user: User = Depends(require_permission("can_manage_quick_actions")), db: AsyncSession = Depends(get_session)):
    qa = await service.create_quick_action(db, req.name, req.icon, [t.model_dump() for t in req.targets], user.id)
    await db.commit()
    return qa


@router.put("/{qa_id}", response_model=schemas.QuickActionResponse)
async def update_quick_action(qa_id: str, req: schemas.QuickActionUpdateRequest, user: User = Depends(require_permission("can_manage_quick_actions")), db: AsyncSession = Depends(get_session)):
    qa = await service.update_quick_action(db, qa_id, req.name, req.icon, [t.model_dump() for t in req.targets])
    if not qa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quick action not found")
    await db.commit()
    return qa


@router.delete("/{qa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quick_action(qa_id: str, user: User = Depends(require_permission("can_manage_quick_actions")), db: AsyncSession = Depends(get_session)):
    if not await service.delete_quick_action(db, qa_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quick action not found")
    await db.commit()


@router.post("/{qa_id}/execute", response_model=dict)
async def execute_quick_action(qa_id: str, user: User = Depends(require_permission("can_execute_quick_actions")), db: AsyncSession = Depends(get_session)):
    qa = await service.get_quick_action(db, qa_id)
    if not qa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quick action not found")
    results = {}
    for target in qa.targets:
        device_ids = await resolve_device_ids(db, target.target_type.value, target.target_id, target.exclude_device_ids)
        for did in device_ids:
            device = await get_device(db, did)
            if device:
                result = await control_device(device.ip, target.state)
                results[did] = result is not None
    await db.commit()
    return {"executed": True, "results": results}


@router.put("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_quick_actions(req: schemas.ReorderRequest, user: User = Depends(require_permission("can_manage_quick_actions")), db: AsyncSession = Depends(get_session)):
    await service.reorder_quick_actions(db, req.order)
    await db.commit()
