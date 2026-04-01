"""Tests for quick action service — creation, targeting, cascading delete."""
import uuid
import pytest
from lighting_control.quick_actions.service import (
    create_quick_action, delete_quick_action, get_all_quick_actions,
    get_quick_action, reorder_quick_actions, update_quick_action,
)


class TestQuickActionCRUD:
    async def test_create_with_single_device_target(self, test_db, admin_user, sample_devices):
        qa = await create_quick_action(test_db, "Turn On Living Lamp", "lightbulb", [{"target_type": "device", "target_id": sample_devices[0].id, "state": {"dimming": 100}}], admin_user.id)
        assert qa.name == "Turn On Living Lamp"
        assert len(qa.targets) == 1
        assert qa.targets[0].target_type.value == "device"
        assert qa.targets[0].state == {"dimming": 100}

    async def test_create_with_room_target(self, test_db, admin_user, sample_devices, two_rooms):
        r1, _ = two_rooms
        qa = await create_quick_action(test_db, "Living Room Warm", None, [{"target_type": "room", "target_id": r1.id, "state": {"temp": 3000, "dimming": 50}}], admin_user.id)
        assert len(qa.targets) == 1
        assert qa.targets[0].target_type.value == "room"

    async def test_create_multi_target_different_states(self, test_db, admin_user, sample_devices, two_rooms):
        r1, r2 = two_rooms
        qa = await create_quick_action(test_db, "Movie Night", "film", [
            {"target_type": "room", "target_id": r1.id, "state": {"dimming": 30, "temp": 2700}},
            {"target_type": "room", "target_id": r2.id, "state": {"sceneId": 3}},
        ], admin_user.id)
        assert len(qa.targets) == 2
        assert qa.targets[0].state["dimming"] == 30
        assert qa.targets[1].state["sceneId"] == 3

    async def test_create_with_all_except(self, test_db, admin_user, sample_devices):
        qa = await create_quick_action(test_db, "All Except Hall", None, [{"target_type": "all_except", "exclude_device_ids": [sample_devices[4].id], "state": {"dimming": 0}}], admin_user.id)
        assert qa.targets[0].exclude_device_ids == [sample_devices[4].id]


class TestQuickActionUpdate:
    async def test_update_replaces_targets(self, test_db, admin_user, sample_devices):
        qa = await create_quick_action(test_db, "Old", None, [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        updated = await update_quick_action(test_db, qa.id, "New", "star", [{"target_type": "device", "target_id": sample_devices[0].id, "state": {"dimming": 50}}])
        assert updated.name == "New"
        assert updated.icon == "star"
        assert len(updated.targets) == 1
        assert updated.targets[0].target_type.value == "device"

    async def test_update_nonexistent_returns_none(self, test_db):
        result = await update_quick_action(test_db, str(uuid.uuid4()), "X", None, [])
        assert result is None


class TestQuickActionDelete:
    async def test_delete_cascades_targets(self, test_db, admin_user, sample_devices):
        qa = await create_quick_action(test_db, "Temp", None, [{"target_type": "all", "state": {"dimming": 0}}, {"target_type": "device", "target_id": sample_devices[0].id, "state": {"dimming": 100}}], admin_user.id)
        qa_id = qa.id
        assert await delete_quick_action(test_db, qa_id) is True
        assert await get_quick_action(test_db, qa_id) is None

    async def test_delete_nonexistent_returns_false(self, test_db):
        assert await delete_quick_action(test_db, str(uuid.uuid4())) is False


class TestQuickActionReorder:
    async def test_reorder_updates_sort_order(self, test_db, admin_user, sample_devices):
        qa1 = await create_quick_action(test_db, "First", None, [{"target_type": "all", "state": {"dimming": 0}}], admin_user.id)
        qa2 = await create_quick_action(test_db, "Second", None, [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        await reorder_quick_actions(test_db, [qa2.id, qa1.id])
        all_qa = await get_all_quick_actions(test_db)
        assert all_qa[0].id == qa2.id
        assert all_qa[0].sort_order == 0
        assert all_qa[1].id == qa1.id
        assert all_qa[1].sort_order == 1
