"""Tests for device management service — upsert, filtering, target resolution."""
import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy import select
from lighting_control.devices.models import Device, Room, Zone, Group, GroupDevice
from lighting_control.devices.service import (
    assign_device, get_all_devices, get_device, get_device_by_mac,
    rename_device, resolve_device_ids, update_device_state, upsert_device,
    create_room, get_all_rooms, create_zone, create_group, get_all_groups,
    export_hierarchy, import_hierarchy,
)


class TestUpsertDevice:
    async def test_upsert_creates_new_device(self, test_db):
        device = await upsert_device(test_db, mac="AA:BB:CC:DD:EE:FF", ip="192.168.1.100", name="Test Bulb", bulb_type="RGBW")
        assert device.mac == "AA:BB:CC:DD:EE:FF"
        assert device.ip == "192.168.1.100"
        assert device.name == "Test Bulb"
        assert device.is_online is True
        assert device.last_seen is not None

    async def test_upsert_updates_existing_by_mac(self, test_db):
        await upsert_device(test_db, mac="AA:BB:CC:DD:EE:FF", ip="192.168.1.100")
        device = await upsert_device(test_db, mac="AA:BB:CC:DD:EE:FF", ip="192.168.1.200", model="ESP01")
        assert device.ip == "192.168.1.200"
        assert device.model == "ESP01"

    async def test_upsert_default_name_from_mac(self, test_db):
        device = await upsert_device(test_db, mac="AA:BB:CC:DD:EE:FF", ip="192.168.1.1")
        assert device.name == "WiZ EE:FF"

    async def test_upsert_marks_online(self, test_db):
        device = await upsert_device(test_db, mac="11:22:33:44:55:66", ip="10.0.0.1")
        assert device.is_online is True


class TestDeviceFilters:
    async def test_filter_by_room(self, test_db, sample_devices, two_rooms):
        r1, _ = two_rooms
        devices = await get_all_devices(test_db, room_id=r1.id)
        assert len(devices) == 2
        assert all(d.room_id == r1.id for d in devices)

    async def test_filter_by_zone(self, test_db, sample_devices, one_zone):
        devices = await get_all_devices(test_db, zone_id=one_zone.id)
        assert len(devices) == 2
        assert all(d.zone_id == one_zone.id for d in devices)

    async def test_filter_by_group(self, test_db, sample_devices, one_group):
        devices = await get_all_devices(test_db, group_id=one_group.id)
        assert len(devices) == 2

    async def test_filter_online_only(self, test_db, sample_devices):
        devices = await get_all_devices(test_db, online_only=True)
        assert len(devices) == 4
        assert all(d.is_online for d in devices)

    async def test_no_filters_returns_all(self, test_db, sample_devices):
        devices = await get_all_devices(test_db)
        assert len(devices) == 5


class TestDeviceMutations:
    async def test_rename_device(self, test_db, sample_devices):
        device = sample_devices[0]
        renamed = await rename_device(test_db, device.id, "New Name")
        assert renamed.name == "New Name"

    async def test_rename_nonexistent_returns_none(self, test_db):
        result = await rename_device(test_db, str(uuid.uuid4()), "Whatever")
        assert result is None

    async def test_assign_device_to_room(self, test_db, sample_devices, two_rooms):
        _, r2 = two_rooms
        device = sample_devices[4]
        assert device.room_id is None
        updated = await assign_device(test_db, device.id, r2.id, None)
        assert updated.room_id == r2.id

    async def test_update_device_state(self, test_db, sample_devices):
        device = sample_devices[0]
        state = {"dimming": 50, "r": 255, "g": 0, "b": 0}
        await update_device_state(test_db, device.id, state)
        refreshed = await get_device(test_db, device.id)
        assert refreshed.last_state == state


class TestResolveDeviceIds:
    async def test_resolve_single_device(self, test_db, sample_devices):
        ids = await resolve_device_ids(test_db, "device", sample_devices[0].id)
        assert ids == [sample_devices[0].id]

    async def test_resolve_room(self, test_db, sample_devices, two_rooms):
        r1, _ = two_rooms
        ids = await resolve_device_ids(test_db, "room", r1.id)
        assert len(ids) == 2
        assert sample_devices[0].id in ids
        assert sample_devices[1].id in ids

    async def test_resolve_zone(self, test_db, sample_devices, one_zone):
        ids = await resolve_device_ids(test_db, "zone", one_zone.id)
        assert len(ids) == 2

    async def test_resolve_group(self, test_db, sample_devices, one_group):
        ids = await resolve_device_ids(test_db, "group", one_group.id)
        assert len(ids) == 2
        assert sample_devices[0].id in ids
        assert sample_devices[2].id in ids

    async def test_resolve_all(self, test_db, sample_devices):
        ids = await resolve_device_ids(test_db, "all", None)
        assert len(ids) == 5

    async def test_resolve_all_except(self, test_db, sample_devices):
        exclude = [sample_devices[0].id, sample_devices[1].id]
        ids = await resolve_device_ids(test_db, "all_except", None, exclude)
        assert len(ids) == 3
        assert sample_devices[0].id not in ids
        assert sample_devices[1].id not in ids


class TestRoomZoneGroupCRUD:
    async def test_create_room(self, test_db):
        room = await create_room(test_db, "Kitchen", "utensils")
        assert room.name == "Kitchen"
        assert room.icon == "utensils"

    async def test_create_zone(self, test_db):
        room = await create_room(test_db, "Test Room")
        zone = await create_zone(test_db, "Downstairs", room.id)
        assert zone.name == "Downstairs"
        assert zone.room_id == room.id

    async def test_create_group_with_devices(self, test_db):
        d1 = Device(id=str(uuid.uuid4()), mac="FF:FF:FF:FF:FF:01", ip="10.0.0.1", name="D1", is_online=True)
        d2 = Device(id=str(uuid.uuid4()), mac="FF:FF:FF:FF:FF:02", ip="10.0.0.2", name="D2", is_online=True)
        test_db.add_all([d1, d2])
        await test_db.flush()
        group = await create_group(test_db, "Party", None, [d1.id, d2.id])
        assert group.name == "Party"
        groups = await get_all_groups(test_db)
        assert len(groups) == 1


class TestHierarchyExportImport:
    async def test_export_contains_rooms_zones_groups(self, test_db, sample_devices, two_rooms, one_zone, one_group):
        result = await export_hierarchy(test_db)
        assert "rooms" in result and "groups" in result
        assert len(result["rooms"]) == 2
        assert len(result["groups"]) == 1
        bedroom = next(r for r in result["rooms"] if r["name"] == "Bedroom")
        assert len(bedroom["zones"]) == 1
        assert bedroom["zones"][0]["name"] == "Upstairs"
        assert set(bedroom["zones"][0]["device_macs"]) == {"AA:BB:CC:DD:EE:03", "AA:BB:CC:DD:EE:04"}
        living = next(r for r in result["rooms"] if r["name"] == "Living Room")
        assert set(living["device_macs"]) == {"AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02"}
        assert len(living["zones"]) == 0
        movie_group = result["groups"][0]
        assert movie_group["name"] == "Movie Lights"
        assert set(movie_group["device_macs"]) == {"AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:03"}

    async def test_export_roundtrip_into_fresh_db(self, test_db, sample_devices, two_rooms, one_zone, one_group):
        exported = await export_hierarchy(test_db)
        from lighting_control.devices.models import Room as RoomModel, Zone as ZoneModel, Group as GroupModel, GroupDevice as GDModel
        from sqlalchemy import delete
        await test_db.execute(delete(GDModel))
        await test_db.execute(delete(GroupModel))
        for d in sample_devices:
            d.room_id = None
            d.zone_id = None
        await test_db.flush()
        await test_db.execute(delete(ZoneModel))
        await test_db.execute(delete(RoomModel))
        await test_db.flush()
        result = await import_hierarchy(test_db, exported)
        assert result["rooms_created"] == 2
        assert result["zones_created"] == 1
        assert result["groups_created"] == 1
        assert result["devices_assigned"] == 4
        re_exported = await export_hierarchy(test_db)
        assert len(re_exported["rooms"]) == 2
        assert len(re_exported["groups"]) == 1
        bedroom = next(r for r in re_exported["rooms"] if r["name"] == "Bedroom")
        assert set(bedroom["zones"][0]["device_macs"]) == {"AA:BB:CC:DD:EE:03", "AA:BB:CC:DD:EE:04"}

    async def test_import_idempotent_updates_existing(self, test_db, sample_devices, two_rooms, one_zone, one_group):
        exported = await export_hierarchy(test_db)
        result = await import_hierarchy(test_db, exported)
        assert result["rooms_updated"] == 2
        assert result["rooms_created"] == 0
        assert result["zones_updated"] == 1
        assert result["zones_created"] == 0
        assert result["groups_updated"] == 1
        assert result["groups_created"] == 0

    async def test_import_skips_unknown_macs(self, test_db):
        data = {"rooms": [{"name": "Ghost Room", "icon": None, "zones": [], "device_macs": ["ZZ:ZZ:ZZ:ZZ:ZZ:ZZ"]}], "groups": []}
        result = await import_hierarchy(test_db, data)
        assert result["rooms_created"] == 1
        assert result["devices_assigned"] == 0

    async def test_device_only_in_one_room_zone(self, test_db, sample_devices):
        """A device MAC appearing in multiple rooms should end up in whichever one is processed last."""
        data = {"rooms": [{"name": "Room A", "icon": None, "zones": [], "device_macs": ["AA:BB:CC:DD:EE:01"]}, {"name": "Room B", "icon": None, "zones": [{"name": "Z1", "icon": None, "device_macs": ["AA:BB:CC:DD:EE:01"]}], "device_macs": []}], "groups": []}
        await import_hierarchy(test_db, data)
        device = await get_device_by_mac(test_db, "AA:BB:CC:DD:EE:01")
        room_b = (await test_db.execute(select(Room).where(Room.name == "Room B"))).scalar_one()
        assert device.room_id == room_b.id
        assert device.zone_id is not None
