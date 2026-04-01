"""Tests for schedule service and trigger logic."""
import hashlib
import hmac
import uuid
import pytest
from lighting_control.schedules.service import (
    create_schedule, delete_schedule, get_all_schedules,
    get_schedule, set_schedule_enabled, update_schedule,
)


class TestScheduleCRUD:
    async def test_create_schedule_with_cron_trigger(self, test_db, admin_user, sample_devices):
        schedule = await create_schedule(test_db, "Nightly Off", 10, [{"trigger_type": "cron", "cron_expression": "0 23 * * *"}], [{"target_type": "all", "state": {"state": False}}], admin_user.id)
        assert schedule.name == "Nightly Off"
        assert schedule.priority == 10
        assert schedule.enabled is True
        assert len(schedule.triggers) == 1
        assert schedule.triggers[0].trigger_type.value == "cron"
        assert schedule.triggers[0].cron_expression == "0 23 * * *"
        assert len(schedule.targets) == 1

    async def test_create_schedule_with_webhook_trigger(self, test_db, admin_user, sample_devices):
        schedule = await create_schedule(test_db, "External Trigger", 5, [{"trigger_type": "webhook"}], [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        assert schedule.triggers[0].trigger_type.value == "webhook"
        assert schedule.triggers[0].webhook_secret_hash is not None
        assert len(schedule.triggers[0].webhook_secret_hash) == 64

    async def test_create_schedule_with_sunrise_trigger(self, test_db, admin_user, sample_devices):
        schedule = await create_schedule(test_db, "Sunrise Warmup", 8, [{"trigger_type": "sunrise", "offset_minutes": -15}], [{"target_type": "all", "state": {"temp": 3000, "dimming": 30}}], admin_user.id)
        assert schedule.triggers[0].trigger_type.value == "sunrise"
        assert schedule.triggers[0].offset_minutes == -15


class TestScheduleEnableDisable:
    async def test_disable_schedule(self, test_db, admin_user, sample_devices):
        schedule = await create_schedule(test_db, "Test", 1, [{"trigger_type": "cron", "cron_expression": "* * * * *"}], [{"target_type": "all", "state": {}}], admin_user.id)
        assert schedule.enabled is True
        updated = await set_schedule_enabled(test_db, schedule.id, False)
        assert updated.enabled is False

    async def test_enable_schedule(self, test_db, admin_user, sample_devices):
        schedule = await create_schedule(test_db, "Test", 1, [{"trigger_type": "cron", "cron_expression": "* * * * *"}], [{"target_type": "all", "state": {}}], admin_user.id)
        await set_schedule_enabled(test_db, schedule.id, False)
        updated = await set_schedule_enabled(test_db, schedule.id, True)
        assert updated.enabled is True


class TestScheduleDelete:
    async def test_delete_cascades(self, test_db, admin_user, sample_devices):
        schedule = await create_schedule(test_db, "Delete Me", 1, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}, {"trigger_type": "sunset", "offset_minutes": 30}], [{"target_type": "all", "state": {}}], admin_user.id)
        sid = schedule.id
        assert await delete_schedule(test_db, sid) is True
        assert await get_schedule(test_db, sid) is None

    async def test_delete_nonexistent(self, test_db):
        assert await delete_schedule(test_db, str(uuid.uuid4())) is False


class TestSchedulePriority:
    async def test_schedules_ordered_by_priority_desc(self, test_db, admin_user, sample_devices):
        await create_schedule(test_db, "Low", 1, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], [{"target_type": "all", "state": {}}], admin_user.id)
        await create_schedule(test_db, "High", 99, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], [{"target_type": "all", "state": {}}], admin_user.id)
        await create_schedule(test_db, "Mid", 50, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], [{"target_type": "all", "state": {}}], admin_user.id)
        schedules = await get_all_schedules(test_db)
        priorities = [s.priority for s in schedules]
        assert priorities == [99, 50, 1], f"Expected descending priority, got {priorities}"
