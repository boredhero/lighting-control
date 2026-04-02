"""Device management API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.auth.dependencies import get_current_user, require_permission
from lighting_control.auth.models import User
from lighting_control.db.engine import get_session
from lighting_control.devices import schemas, service, discovery

router = APIRouter(prefix="/devices", tags=["devices"])
rooms_router = APIRouter(prefix="/rooms", tags=["rooms"])
zones_router = APIRouter(prefix="/zones", tags=["zones"])
groups_router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("", response_model=list[schemas.DeviceResponse])
async def list_devices(room_id: str | None = None, zone_id: str | None = None, group_id: str | None = None, online_only: bool = False, bulb_type: str | None = None, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    return await service.get_all_devices(db, room_id=room_id, zone_id=zone_id, group_id=group_id, online_only=online_only, bulb_type=bulb_type)


@router.get("/{device_id}", response_model=schemas.DeviceResponse)
async def get_device(device_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    device = await service.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.post("/{device_id}/control", response_model=dict)
async def control_device(device_id: str, req: schemas.DeviceControlRequest, user: User = Depends(require_permission("can_control_devices")), db: AsyncSession = Depends(get_session)):
    device = await service.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    result = await discovery.control_device(device.ip, req.state)
    if result:
        await service.update_device_state(db, device_id, result)
        await db.commit()
    return {"success": result is not None, "state": result}


@router.post("/bulk-control", response_model=dict)
async def bulk_control(req: schemas.BulkControlRequest, user: User = Depends(require_permission("can_control_devices")), db: AsyncSession = Depends(get_session)):
    results = {}
    for did in req.device_ids:
        device = await service.get_device(db, did)
        if device:
            result = await discovery.control_device(device.ip, req.state)
            if result:
                await service.update_device_state(db, did, result)
            results[did] = result is not None
    await db.commit()
    return {"results": results}


@router.get("/export", response_model=list[dict])
async def export_devices(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    """Export all device MAC→name mappings as JSON for backup/restore."""
    devices = await service.get_all_devices(db)
    return [{"mac": d.mac, "name": d.name} for d in devices]


@router.post("/import", response_model=dict)
async def import_devices(mappings: list[dict], user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    """Restore device names from a previously exported MAC→name list."""
    updated = 0
    for mapping in mappings:
        mac = mapping.get("mac")
        name = mapping.get("name")
        if not mac or not name:
            continue
        device = await service.get_device_by_mac(db, mac)
        if device:
            device.name = name
            updated += 1
    await db.commit()
    return {"updated": updated, "total": len(mappings)}


@router.get("/hierarchy", response_model=dict)
async def get_hierarchy(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    """Full nested hierarchy: rooms → zones → devices, plus unassigned and groups."""
    from sqlalchemy.orm import selectinload
    rooms_result = await db.execute(select(service.Room).options(selectinload(service.Room.zones).selectinload(service.Zone.devices), selectinload(service.Room.devices)).order_by(service.Room.sort_order))
    rooms = rooms_result.scalars().unique().all()
    all_devices = await service.get_all_devices(db)
    assigned_ids = set()
    rooms_data = []
    for room in rooms:
        zones_data = []
        for zone in room.zones:
            zone_devices = [{"id": d.id, "name": d.name, "mac": d.mac, "ip": d.ip, "is_online": d.is_online, "last_state": d.last_state} for d in zone.devices]
            for d in zone.devices:
                assigned_ids.add(d.id)
            zones_data.append({"id": zone.id, "name": zone.name, "icon": zone.icon, "devices": zone_devices})
        unzoned = [{"id": d.id, "name": d.name, "mac": d.mac, "ip": d.ip, "is_online": d.is_online, "last_state": d.last_state} for d in room.devices if d.zone_id is None]
        for d in room.devices:
            assigned_ids.add(d.id)
        rooms_data.append({"id": room.id, "name": room.name, "icon": room.icon, "zones": zones_data, "devices": unzoned})
    unassigned = [{"id": d.id, "name": d.name, "mac": d.mac, "ip": d.ip, "is_online": d.is_online, "last_state": d.last_state} for d in all_devices if d.id not in assigned_ids]
    groups = await service.get_all_groups(db)
    groups_data = [{"id": g.id, "name": g.name, "icon": g.icon, "device_ids": [gd.device_id for gd in g.group_devices]} for g in groups]
    return {"rooms": rooms_data, "unassigned": unassigned, "groups": groups_data}


@router.post("/discover", response_model=dict)
async def trigger_discovery(user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    count = await discovery.run_discovery_and_persist()
    return {"discovered": count}


@router.post("/{device_id}/rename", response_model=schemas.DeviceResponse)
async def rename_device(device_id: str, req: schemas.DeviceRenameRequest, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    device = await service.rename_device(db, device_id, req.name)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    await db.commit()
    return device


@router.post("/{device_id}/assign", response_model=schemas.DeviceResponse)
async def assign_device(device_id: str, req: schemas.DeviceAssignRequest, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    device = await service.assign_device(db, device_id, req.room_id, req.zone_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    await db.commit()
    return device


# --- Rooms ---
@rooms_router.get("", response_model=list[schemas.RoomResponse])
async def list_rooms(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    return await service.get_all_rooms(db)


@rooms_router.post("", response_model=schemas.RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(req: schemas.RoomRequest, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    room = await service.create_room(db, req.name, req.icon)
    await db.commit()
    return room


@rooms_router.put("/{room_id}", response_model=schemas.RoomResponse)
async def update_room(room_id: str, req: schemas.RoomRequest, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    room = await service.update_room(db, room_id, req.name, req.icon)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    await db.commit()
    return room


@rooms_router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(room_id: str, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    if not await service.delete_room(db, room_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    await db.commit()


# --- Zones ---
@zones_router.get("", response_model=list[schemas.ZoneResponse])
async def list_zones(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    return await service.get_all_zones(db)


@zones_router.post("", response_model=schemas.ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(req: schemas.ZoneRequest, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    zone = await service.create_zone(db, req.name, req.room_id, req.icon)
    await db.commit()
    return zone


@zones_router.put("/{zone_id}", response_model=schemas.ZoneResponse)
async def update_zone(zone_id: str, req: schemas.ZoneRequest, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    zone = await service.update_zone(db, zone_id, req.name, req.room_id, req.icon)
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    await db.commit()
    return zone


@zones_router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(zone_id: str, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    if not await service.delete_zone(db, zone_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    await db.commit()


# --- Groups ---
@groups_router.get("", response_model=list[schemas.GroupResponse])
async def list_groups(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    groups = await service.get_all_groups(db)
    return [schemas.GroupResponse(id=g.id, name=g.name, icon=g.icon, sort_order=g.sort_order, device_ids=[gd.device_id for gd in g.group_devices], created_at=g.created_at) for g in groups]


@groups_router.post("", response_model=schemas.GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(req: schemas.GroupRequest, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    group = await service.create_group(db, req.name, req.icon, req.device_ids)
    await db.commit()
    group = await service.get_group(db, group.id)
    return schemas.GroupResponse(id=group.id, name=group.name, icon=group.icon, sort_order=group.sort_order, device_ids=[gd.device_id for gd in group.group_devices], created_at=group.created_at)


@groups_router.put("/{group_id}", response_model=schemas.GroupResponse)
async def update_group(group_id: str, req: schemas.GroupRequest, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    group = await service.update_group(db, group_id, req.name, req.icon, req.device_ids)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    await db.commit()
    group = await service.get_group(db, group.id)
    return schemas.GroupResponse(id=group.id, name=group.name, icon=group.icon, sort_order=group.sort_order, device_ids=[gd.device_id for gd in group.group_devices], created_at=group.created_at)


@groups_router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(group_id: str, user: User = Depends(require_permission("can_manage_devices")), db: AsyncSession = Depends(get_session)):
    if not await service.delete_group(db, group_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    await db.commit()
