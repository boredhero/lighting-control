"""Device management business logic."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from lighting_control.devices.models import Device, Group, GroupDevice, Room, Zone


async def get_all_devices(db: AsyncSession, room_id: str | None = None, zone_id: str | None = None, group_id: str | None = None, online_only: bool = False, bulb_type: str | None = None) -> list[Device]:
    query = select(Device)
    if room_id:
        query = query.where(Device.room_id == room_id)
    if zone_id:
        query = query.where(Device.zone_id == zone_id)
    if online_only:
        query = query.where(Device.is_online == True)
    if bulb_type:
        query = query.where(Device.bulb_type == bulb_type)
    if group_id:
        query = query.join(GroupDevice).where(GroupDevice.group_id == group_id)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_device(db: AsyncSession, device_id: str) -> Device | None:
    result = await db.execute(select(Device).where(Device.id == device_id))
    return result.scalar_one_or_none()


async def get_device_by_mac(db: AsyncSession, mac: str) -> Device | None:
    result = await db.execute(select(Device).where(Device.mac == mac))
    return result.scalar_one_or_none()


async def upsert_device(db: AsyncSession, mac: str, ip: str, name: str | None = None, model: str | None = None, module_name: str | None = None, bulb_type: str | None = None, firmware_version: str | None = None) -> Device:
    device = await get_device_by_mac(db, mac)
    if device:
        device.ip = ip
        device.last_seen = datetime.now(timezone.utc)
        device.is_online = True
        if model:
            device.model = model
        if module_name:
            device.module_name = module_name
        if bulb_type:
            device.bulb_type = bulb_type
        if firmware_version:
            device.firmware_version = firmware_version
    else:
        device = Device(mac=mac, ip=ip, name=name or f"WiZ {mac[-5:]}", model=model, module_name=module_name, bulb_type=bulb_type, firmware_version=firmware_version, last_seen=datetime.now(timezone.utc), is_online=True)
        db.add(device)
    await db.flush()
    return device


async def update_device_state(db: AsyncSession, device_id: str, state: dict) -> None:
    device = await get_device(db, device_id)
    if device:
        device.last_state = state
        device.last_seen = datetime.now(timezone.utc)
        device.is_online = True
        await db.flush()


async def rename_device(db: AsyncSession, device_id: str, name: str) -> Device | None:
    device = await get_device(db, device_id)
    if device:
        device.name = name
        await db.flush()
    return device


async def assign_device(db: AsyncSession, device_id: str, room_id: str | None, zone_id: str | None) -> Device | None:
    device = await get_device(db, device_id)
    if device:
        device.room_id = room_id
        device.zone_id = zone_id
        await db.flush()
    return device


async def get_all_rooms(db: AsyncSession) -> list[Room]:
    result = await db.execute(select(Room).order_by(Room.sort_order))
    return list(result.scalars().all())


async def create_room(db: AsyncSession, name: str, icon: str | None = None) -> Room:
    room = Room(name=name, icon=icon)
    db.add(room)
    await db.flush()
    return room


async def get_room(db: AsyncSession, room_id: str) -> Room | None:
    result = await db.execute(select(Room).where(Room.id == room_id))
    return result.scalar_one_or_none()


async def update_room(db: AsyncSession, room_id: str, name: str, icon: str | None) -> Room | None:
    room = await get_room(db, room_id)
    if room:
        room.name = name
        room.icon = icon
        await db.flush()
    return room


async def delete_room(db: AsyncSession, room_id: str) -> bool:
    room = await get_room(db, room_id)
    if room:
        await db.delete(room)
        await db.flush()
        return True
    return False


async def get_all_zones(db: AsyncSession) -> list[Zone]:
    result = await db.execute(select(Zone).order_by(Zone.sort_order))
    return list(result.scalars().all())


async def create_zone(db: AsyncSession, name: str, room_id: str, icon: str | None = None) -> Zone:
    zone = Zone(name=name, room_id=room_id, icon=icon)
    db.add(zone)
    await db.flush()
    return zone


async def get_zone(db: AsyncSession, zone_id: str) -> Zone | None:
    result = await db.execute(select(Zone).where(Zone.id == zone_id))
    return result.scalar_one_or_none()


async def update_zone(db: AsyncSession, zone_id: str, name: str, room_id: str, icon: str | None) -> Zone | None:
    zone = await get_zone(db, zone_id)
    if zone:
        zone.name = name
        zone.room_id = room_id
        zone.icon = icon
        await db.flush()
    return zone


async def delete_zone(db: AsyncSession, zone_id: str) -> bool:
    zone = await get_zone(db, zone_id)
    if zone:
        await db.delete(zone)
        await db.flush()
        return True
    return False


async def get_all_groups(db: AsyncSession) -> list[Group]:
    result = await db.execute(select(Group).options(selectinload(Group.group_devices)).order_by(Group.sort_order))
    return list(result.scalars().all())


async def create_group(db: AsyncSession, name: str, icon: str | None, device_ids: list[str]) -> Group:
    group = Group(name=name, icon=icon)
    db.add(group)
    await db.flush()
    for did in device_ids:
        gd = GroupDevice(group_id=group.id, device_id=did)
        db.add(gd)
    await db.flush()
    return group


async def get_group(db: AsyncSession, group_id: str) -> Group | None:
    result = await db.execute(select(Group).options(selectinload(Group.group_devices)).where(Group.id == group_id))
    return result.scalar_one_or_none()


async def update_group(db: AsyncSession, group_id: str, name: str, icon: str | None, device_ids: list[str]) -> Group | None:
    group = await get_group(db, group_id)
    if not group:
        return None
    group.name = name
    group.icon = icon
    for gd in group.group_devices:
        await db.delete(gd)
    await db.flush()
    for did in device_ids:
        gd = GroupDevice(group_id=group.id, device_id=did)
        db.add(gd)
    await db.flush()
    return group


async def delete_group(db: AsyncSession, group_id: str) -> bool:
    group = await get_group(db, group_id)
    if group:
        await db.delete(group)
        await db.flush()
        return True
    return False


async def export_hierarchy(db: AsyncSession) -> dict:
    """Export rooms, zones, groups, and device assignments as a MAC-based JSON structure."""
    rooms = await db.execute(select(Room).options(selectinload(Room.zones).selectinload(Zone.devices), selectinload(Room.devices)).order_by(Room.sort_order))
    rooms_data = []
    for room in rooms.scalars().unique().all():
        zones_data = []
        for zone in sorted(room.zones, key=lambda z: z.sort_order):
            zones_data.append({"name": zone.name, "icon": zone.icon, "device_macs": [d.mac for d in zone.devices]})
        unzoned_macs = [d.mac for d in room.devices if d.zone_id is None]
        rooms_data.append({"name": room.name, "icon": room.icon, "zones": zones_data, "device_macs": unzoned_macs})
    groups = await get_all_groups(db)
    all_devices = await get_all_devices(db)
    device_map = {d.id: d.mac for d in all_devices}
    groups_data = [{"name": g.name, "icon": g.icon, "device_macs": [device_map[gd.device_id] for gd in g.group_devices if gd.device_id in device_map]} for g in groups]
    return {"rooms": rooms_data, "groups": groups_data}


async def import_hierarchy(db: AsyncSession, data: dict) -> dict:
    """Restore rooms, zones, groups, and device assignments from an exported JSON structure. Returns summary counts."""
    all_devices = await get_all_devices(db)
    mac_to_device = {d.mac: d for d in all_devices}
    rooms_created = 0
    rooms_updated = 0
    zones_created = 0
    zones_updated = 0
    groups_created = 0
    groups_updated = 0
    devices_assigned = 0
    for room_data in data.get("rooms", []):
        existing_rooms = await db.execute(select(Room).where(Room.name == room_data["name"]))
        room = existing_rooms.scalar_one_or_none()
        if room:
            room.icon = room_data.get("icon")
            rooms_updated += 1
        else:
            room = Room(name=room_data["name"], icon=room_data.get("icon"))
            db.add(room)
            await db.flush()
            rooms_created += 1
        for mac in room_data.get("device_macs", []):
            device = mac_to_device.get(mac)
            if device:
                device.room_id = room.id
                device.zone_id = None
                devices_assigned += 1
        for zone_data in room_data.get("zones", []):
            existing_zones = await db.execute(select(Zone).where(Zone.name == zone_data["name"], Zone.room_id == room.id))
            zone = existing_zones.scalar_one_or_none()
            if zone:
                zone.icon = zone_data.get("icon")
                zones_updated += 1
            else:
                zone = Zone(name=zone_data["name"], room_id=room.id, icon=zone_data.get("icon"))
                db.add(zone)
                await db.flush()
                zones_created += 1
            for mac in zone_data.get("device_macs", []):
                device = mac_to_device.get(mac)
                if device:
                    device.room_id = room.id
                    device.zone_id = zone.id
                    devices_assigned += 1
    for group_data in data.get("groups", []):
        existing_groups = await db.execute(select(Group).options(selectinload(Group.group_devices)).where(Group.name == group_data["name"]))
        group = existing_groups.scalar_one_or_none()
        if group:
            group.icon = group_data.get("icon")
            for gd in group.group_devices:
                await db.delete(gd)
            await db.flush()
            groups_updated += 1
        else:
            group = Group(name=group_data["name"], icon=group_data.get("icon"))
            db.add(group)
            await db.flush()
            groups_created += 1
        for mac in group_data.get("device_macs", []):
            device = mac_to_device.get(mac)
            if device:
                gd = GroupDevice(group_id=group.id, device_id=device.id)
                db.add(gd)
    await db.flush()
    return {"rooms_created": rooms_created, "rooms_updated": rooms_updated, "zones_created": zones_created, "zones_updated": zones_updated, "groups_created": groups_created, "groups_updated": groups_updated, "devices_assigned": devices_assigned}


async def resolve_device_ids(db: AsyncSession, target_type: str, target_id: str | None, exclude_device_ids: list[str] | None = None) -> list[str]:
    """Resolve a target (room, zone, group, all, all_except, device) to a list of device IDs."""
    if target_type == "device" and target_id:
        return [target_id]
    elif target_type == "room" and target_id:
        devices = await get_all_devices(db, room_id=target_id)
        return [d.id for d in devices]
    elif target_type == "zone" and target_id:
        devices = await get_all_devices(db, zone_id=target_id)
        return [d.id for d in devices]
    elif target_type == "group" and target_id:
        devices = await get_all_devices(db, group_id=target_id)
        return [d.id for d in devices]
    elif target_type == "all":
        devices = await get_all_devices(db)
        return [d.id for d in devices]
    elif target_type == "all_except":
        devices = await get_all_devices(db)
        excludes = set(exclude_device_ids or [])
        return [d.id for d in devices if d.id not in excludes]
    return []
