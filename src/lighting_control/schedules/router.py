"""Schedule API endpoints."""
import hashlib
import hmac
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.auth.dependencies import get_current_user, require_permission
from lighting_control.auth.models import User, SystemConfig
from lighting_control.db.engine import get_session
from lighting_control.schedules import schemas, service
from lighting_control.schedules.models import ScheduleTrigger, TriggerType

router = APIRouter(prefix="/schedules", tags=["schedules"])
settings_router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=list[schemas.ScheduleResponse])
async def list_schedules(user: User = Depends(require_permission("can_view_schedules")), db: AsyncSession = Depends(get_session)):
    return await service.get_all_schedules(db)


@router.get("/{schedule_id}", response_model=schemas.ScheduleResponse)
async def get_schedule(schedule_id: str, user: User = Depends(require_permission("can_view_schedules")), db: AsyncSession = Depends(get_session)):
    schedule = await service.get_schedule(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return schedule


@router.post("", response_model=schemas.ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(req: schemas.ScheduleCreateRequest, user: User = Depends(require_permission("can_manage_schedules")), db: AsyncSession = Depends(get_session)):
    schedule = await service.create_schedule(db, req.name, req.priority, [t.model_dump() for t in req.triggers], [t.model_dump() for t in req.targets], user.id)
    await db.commit()
    return schedule


@router.put("/{schedule_id}", response_model=schemas.ScheduleResponse)
async def update_schedule(schedule_id: str, req: schemas.ScheduleUpdateRequest, user: User = Depends(require_permission("can_manage_schedules")), db: AsyncSession = Depends(get_session)):
    schedule = await service.update_schedule(db, schedule_id, req.name, req.priority, [t.model_dump() for t in req.triggers], [t.model_dump() for t in req.targets])
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    await db.commit()
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(schedule_id: str, user: User = Depends(require_permission("can_manage_schedules")), db: AsyncSession = Depends(get_session)):
    if not await service.delete_schedule(db, schedule_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    await db.commit()


@router.post("/{schedule_id}/enable", response_model=schemas.ScheduleResponse)
async def enable_schedule(schedule_id: str, user: User = Depends(require_permission("can_manage_schedules")), db: AsyncSession = Depends(get_session)):
    schedule = await service.set_schedule_enabled(db, schedule_id, True)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    await db.commit()
    return schedule


@router.post("/{schedule_id}/disable", response_model=schemas.ScheduleResponse)
async def disable_schedule(schedule_id: str, user: User = Depends(require_permission("can_manage_schedules")), db: AsyncSession = Depends(get_session)):
    schedule = await service.set_schedule_enabled(db, schedule_id, False)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    await db.commit()
    return schedule


@router.post("/{schedule_id}/trigger/{secret}")
async def webhook_trigger(schedule_id: str, secret: str, db: AsyncSession = Depends(get_session)):
    """External webhook trigger — no auth required, uses secret for verification."""
    schedule = await service.get_schedule(db, schedule_id)
    if not schedule or not schedule.enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found or disabled")
    secret_hash = hashlib.sha256(secret.encode()).hexdigest()
    found = False
    for trigger in schedule.triggers:
        if trigger.trigger_type == TriggerType.WEBHOOK and trigger.webhook_secret_hash:
            if hmac.compare_digest(trigger.webhook_secret_hash, secret_hash):
                found = True
                break
    if not found:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook secret")
    from lighting_control.schedules.engine import execute_schedule
    await execute_schedule(db, schedule)
    await db.commit()
    return {"triggered": True}


# --- Location settings ---
@settings_router.get("/location", response_model=schemas.LocationSettings)
async def get_location(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    lat_row = (await db.execute(select(SystemConfig).where(SystemConfig.key == "location_latitude"))).scalar_one_or_none()
    lon_row = (await db.execute(select(SystemConfig).where(SystemConfig.key == "location_longitude"))).scalar_one_or_none()
    tz_row = (await db.execute(select(SystemConfig).where(SystemConfig.key == "location_timezone"))).scalar_one_or_none()
    return schemas.LocationSettings(latitude=float(lat_row.value) if lat_row else None, longitude=float(lon_row.value) if lon_row else None, timezone=tz_row.value if tz_row else "America/New_York")


@settings_router.put("/location", response_model=schemas.LocationSettings)
async def set_location(req: schemas.LocationSettings, user: User = Depends(require_permission("can_manage_schedules")), db: AsyncSession = Depends(get_session)):
    for key, value in [("location_latitude", str(req.latitude) if req.latitude else ""), ("location_longitude", str(req.longitude) if req.longitude else ""), ("location_timezone", req.timezone)]:
        row = (await db.execute(select(SystemConfig).where(SystemConfig.key == key))).scalar_one_or_none()
        if row:
            row.value = value
        else:
            db.add(SystemConfig(key=key, value=value))
    await db.commit()
    return req
