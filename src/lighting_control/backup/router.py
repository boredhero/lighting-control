"""Unified backup/restore HTTP endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.auth.dependencies import get_current_user, require_permission
from lighting_control.auth.models import User
from lighting_control.backup import schemas, service
from lighting_control.db.engine import get_session

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/export", response_model=schemas.BackupEnvelope)
async def export_backup(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    """Return the full unified backup envelope as JSON."""
    return await service.export_all(db)


@router.post("/import", response_model=schemas.RestoreResponse)
async def import_backup(req: schemas.RestoreRequest, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    """Restore from a backup envelope. Atomic — any failure rolls back the whole restore."""
    try:
        result = await service.import_all(db, req.version, req.data.model_dump(), req.mode, user.id)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        await db.rollback()
        raise
    await db.commit()
    return result
