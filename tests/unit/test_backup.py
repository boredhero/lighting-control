"""Tests for unified backup/restore — round-trip, merge/replace modes, atomicity, FK remap, security invariants."""
import pytest
from lighting_control.backup import service as backup_service
from lighting_control.backup.schemas import BACKUP_VERSION
from lighting_control.devices import service as devices_service
from lighting_control.schedules import service as schedules_service
from lighting_control.quick_actions import service as qa_service
from lighting_control.scenes import service as scenes_service


def _empty_backup_payload() -> dict:
    return {"devices": [], "hierarchy": {"rooms": [], "groups": []}, "schedules": [], "quick_actions": [], "scenes": []}


class TestRoundTrip:
    async def test_devices_round_trip_preserves_mac_and_name(self, test_db, admin_user, sample_devices):
        envelope_a = await backup_service.export_all(test_db)
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope_a["data"], "merge", admin_user.id)
        envelope_b = await backup_service.export_all(test_db)
        macs_a = sorted(d["mac"] for d in envelope_a["data"]["devices"])
        macs_b = sorted(d["mac"] for d in envelope_b["data"]["devices"])
        assert macs_a == macs_b
        names_a = {d["mac"]: d["name"] for d in envelope_a["data"]["devices"]}
        names_b = {d["mac"]: d["name"] for d in envelope_b["data"]["devices"]}
        assert names_a == names_b

    async def test_hierarchy_round_trip_preserves_rooms_zones_groups(self, test_db, admin_user, sample_devices, two_rooms, one_zone, one_group):
        envelope_a = await backup_service.export_all(test_db)
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope_a["data"], "merge", admin_user.id)
        envelope_b = await backup_service.export_all(test_db)
        room_names_a = sorted(r["name"] for r in envelope_a["data"]["hierarchy"]["rooms"])
        room_names_b = sorted(r["name"] for r in envelope_b["data"]["hierarchy"]["rooms"])
        assert room_names_a == room_names_b
        group_names_a = sorted(g["name"] for g in envelope_a["data"]["hierarchy"]["groups"])
        group_names_b = sorted(g["name"] for g in envelope_b["data"]["hierarchy"]["groups"])
        assert group_names_a == group_names_b

    async def test_schedule_round_trip_preserves_priority_enabled_and_state(self, test_db, admin_user, sample_devices):
        await schedules_service.create_schedule(test_db, "Bedtime", 7, [{"trigger_type": "cron", "cron_expression": "0 22 * * *"}], [{"target_type": "all", "state": {"dimming": 25}}], admin_user.id)
        await schedules_service.create_schedule(test_db, "Wake", 3, [{"trigger_type": "sunrise", "offset_minutes": -15}], [{"target_type": "all", "state": {"dimming": 80, "temp": 4000}}], admin_user.id)
        envelope_a = await backup_service.export_all(test_db)
        # Wipe everything via replace, then re-import to confirm specific fields survive
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope_a["data"], "replace", admin_user.id)
        schedules = await schedules_service.get_all_schedules(test_db)
        by_name = {s.name: s for s in schedules}
        assert by_name["Bedtime"].priority == 7
        assert by_name["Bedtime"].enabled is True
        assert by_name["Bedtime"].targets[0].state == {"dimming": 25}
        assert by_name["Wake"].priority == 3
        assert by_name["Wake"].triggers[0].offset_minutes == -15
        assert by_name["Wake"].targets[0].state == {"dimming": 80, "temp": 4000}

    async def test_quick_action_round_trip_preserves_sort_order(self, test_db, admin_user, sample_devices):
        qa1 = await qa_service.create_quick_action(test_db, "First", "star", [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        qa2 = await qa_service.create_quick_action(test_db, "Second", "moon", [{"target_type": "all", "state": {"dimming": 0}}], admin_user.id)
        await qa_service.reorder_quick_actions(test_db, [qa2.id, qa1.id])
        envelope_a = await backup_service.export_all(test_db)
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope_a["data"], "replace", admin_user.id)
        all_qa = await qa_service.get_all_quick_actions(test_db)
        assert all_qa[0].name == "Second"
        assert all_qa[0].sort_order == 0
        assert all_qa[1].name == "First"
        assert all_qa[1].sort_order == 1

    async def test_scene_round_trip_preserves_color_and_brightness(self, test_db, admin_user):
        await scenes_service.create_custom_scene(test_db, "Sunset", 255, 100, 50, None, 75, admin_user.id)
        await scenes_service.create_custom_scene(test_db, "WhiteCool", None, None, None, 6500, 100, admin_user.id)
        envelope_a = await backup_service.export_all(test_db)
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope_a["data"], "replace", admin_user.id)
        all_scenes = await scenes_service.get_all_custom_scenes(test_db)
        by_name = {s.name: s for s in all_scenes}
        assert by_name["Sunset"].color_r == 255
        assert by_name["Sunset"].color_g == 100
        assert by_name["Sunset"].color_b == 50
        assert by_name["Sunset"].brightness == 75
        assert by_name["WhiteCool"].color_temp == 6500
        assert by_name["WhiteCool"].brightness == 100

    @pytest.mark.parametrize("trigger_type,extras", [("cron", {"cron_expression": "0 9 * * *"}), ("sunrise", {"offset_minutes": 30}), ("sunset", {"offset_minutes": -10}), ("webhook", {})])
    async def test_all_4_trigger_types_round_trip(self, test_db, admin_user, sample_devices, trigger_type, extras):
        await schedules_service.create_schedule(test_db, f"Trig-{trigger_type}", 0, [{"trigger_type": trigger_type, **extras}], [{"target_type": "all", "state": {"dimming": 50}}], admin_user.id)
        envelope_a = await backup_service.export_all(test_db)
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope_a["data"], "replace", admin_user.id)
        schedules = await schedules_service.get_all_schedules(test_db)
        s = next(s for s in schedules if s.name == f"Trig-{trigger_type}")
        assert s.triggers[0].trigger_type.value == trigger_type
        if "cron_expression" in extras:
            assert s.triggers[0].cron_expression == extras["cron_expression"]
        if "offset_minutes" in extras:
            assert s.triggers[0].offset_minutes == extras["offset_minutes"]


class TestMergeMode:
    async def test_merge_preserves_existing_rows_not_in_backup(self, test_db, admin_user, sample_devices):
        await schedules_service.create_schedule(test_db, "Pre-existing", 0, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        backup = _empty_backup_payload()
        backup["schedules"] = [{"id": "new-uuid", "name": "FromBackup", "enabled": True, "priority": 0, "triggers": [], "targets": [{"target_type": "all", "state": {"dimming": 50}}]}]
        await backup_service.import_all(test_db, BACKUP_VERSION, backup, "merge", admin_user.id)
        names = {s.name for s in await schedules_service.get_all_schedules(test_db)}
        assert "Pre-existing" in names
        assert "FromBackup" in names

    async def test_merge_idempotent_no_duplicates_on_double_import(self, test_db, admin_user, sample_devices):
        await schedules_service.create_schedule(test_db, "Once", 5, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        envelope = await backup_service.export_all(test_db)
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope["data"], "merge", admin_user.id)
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope["data"], "merge", admin_user.id)
        schedules = await schedules_service.get_all_schedules(test_db)
        once_count = sum(1 for s in schedules if s.name == "Once")
        assert once_count == 1


class TestReplaceMode:
    async def test_replace_wipes_pre_existing_schedules_not_in_backup(self, test_db, admin_user, sample_devices):
        await schedules_service.create_schedule(test_db, "WillBeWiped", 5, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        backup = _empty_backup_payload()
        backup["schedules"] = [{"id": "kept", "name": "FromBackup", "enabled": True, "priority": 0, "triggers": [], "targets": [{"target_type": "all", "state": {"dimming": 0}}]}]
        await backup_service.import_all(test_db, BACKUP_VERSION, backup, "replace", admin_user.id)
        names = {s.name for s in await schedules_service.get_all_schedules(test_db)}
        assert "WillBeWiped" not in names
        assert "FromBackup" in names

    async def test_replace_cascades_schedule_triggers_and_targets(self, test_db, admin_user, sample_devices):
        await schedules_service.create_schedule(test_db, "Doomed", 0, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}, {"trigger_type": "sunrise", "offset_minutes": 0}], [{"target_type": "all", "state": {"dimming": 100}}, {"target_type": "all", "state": {"dimming": 0}}], admin_user.id)
        from lighting_control.schedules.models import ScheduleTrigger, ScheduleTarget
        from sqlalchemy import select, func
        before_triggers = (await test_db.execute(select(func.count()).select_from(ScheduleTrigger))).scalar()
        before_targets = (await test_db.execute(select(func.count()).select_from(ScheduleTarget))).scalar()
        assert before_triggers == 2
        assert before_targets == 2
        await backup_service.import_all(test_db, BACKUP_VERSION, _empty_backup_payload(), "replace", admin_user.id)
        after_triggers = (await test_db.execute(select(func.count()).select_from(ScheduleTrigger))).scalar()
        after_targets = (await test_db.execute(select(func.count()).select_from(ScheduleTarget))).scalar()
        assert after_triggers == 0
        assert after_targets == 0

    async def test_replace_with_empty_backup_wipes_all_workspace_domains(self, test_db, admin_user, sample_devices, two_rooms, one_zone, one_group):
        await schedules_service.create_schedule(test_db, "S", 0, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], [{"target_type": "all", "state": {"dimming": 0}}], admin_user.id)
        await qa_service.create_quick_action(test_db, "Q", None, [{"target_type": "all", "state": {"dimming": 0}}], admin_user.id)
        await scenes_service.create_custom_scene(test_db, "C", 1, 2, 3, None, 50, admin_user.id)
        await backup_service.import_all(test_db, BACKUP_VERSION, _empty_backup_payload(), "replace", admin_user.id)
        assert len(await schedules_service.get_all_schedules(test_db)) == 0
        assert len(await qa_service.get_all_quick_actions(test_db)) == 0
        assert len(await scenes_service.get_all_custom_scenes(test_db)) == 0
        assert len(await devices_service.get_all_rooms(test_db)) == 0
        assert len(await devices_service.get_all_groups(test_db)) == 0


class TestVersionGating:
    async def test_version_zero_is_rejected(self, test_db, admin_user):
        with pytest.raises(ValueError, match="Unsupported backup version"):
            await backup_service.import_all(test_db, 0, _empty_backup_payload(), "merge", admin_user.id)

    async def test_version_too_new_is_rejected(self, test_db, admin_user):
        with pytest.raises(ValueError, match="Unsupported backup version"):
            await backup_service.import_all(test_db, 999, _empty_backup_payload(), "merge", admin_user.id)


class TestPartialPayload:
    async def test_missing_domain_does_not_crash(self, test_db, admin_user, sample_devices):
        # Backup payload missing all 5 domain keys — orchestrator should treat each as empty
        result = await backup_service.import_all(test_db, BACKUP_VERSION, {}, "merge", admin_user.id)
        assert result["schedules"]["created"] == 0
        assert result["scenes"]["created"] == 0


class TestAtomicity:
    async def test_failure_in_last_domain_rolls_back_all_prior_changes(self, test_db, admin_user, sample_devices, monkeypatch):
        # Seed and commit a known schedule so we have something to verify against
        await schedules_service.create_schedule(test_db, "SeededExisting", 5, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        await test_db.commit()
        # Force the LAST per-domain helper (scenes) to raise mid-restore
        async def failing_import_scenes(*args, **kwargs):
            raise RuntimeError("forced failure for atomicity test")
        monkeypatch.setattr(scenes_service, "import_scenes", failing_import_scenes)
        backup = _empty_backup_payload()
        backup["hierarchy"] = {"rooms": [{"id": "r1", "name": "ImportedRoom", "icon": None, "sort_order": 0, "device_macs": [], "zones": []}], "groups": []}
        backup["schedules"] = [{"id": "s1", "name": "ImportedSchedule", "enabled": True, "priority": 0, "triggers": [], "targets": [{"target_type": "all", "state": {"dimming": 0}}]}]
        with pytest.raises(RuntimeError, match="forced failure"):
            await backup_service.import_all(test_db, BACKUP_VERSION, backup, "merge", admin_user.id)
        await test_db.rollback()
        # After rollback, the imported room/schedule must NOT be persisted; the seeded one IS
        rooms = await devices_service.get_all_rooms(test_db)
        assert "ImportedRoom" not in [r.name for r in rooms]
        schedules = await schedules_service.get_all_schedules(test_db)
        names = [s.name for s in schedules]
        assert "ImportedSchedule" not in names
        assert "SeededExisting" in names


class TestQuickActionEdgeCases:
    async def test_quick_action_with_zero_targets_rejected(self, test_db, admin_user, sample_devices):
        backup = _empty_backup_payload()
        backup["quick_actions"] = [{"id": "qa1", "name": "Empty", "icon": None, "sort_order": 0, "targets": []}]
        with pytest.raises(ValueError, match="no targets"):
            await backup_service.import_all(test_db, BACKUP_VERSION, backup, "merge", admin_user.id)


class TestTargetIDRemap:
    async def test_schedule_target_id_resolves_after_replace_restore(self, test_db, admin_user, sample_devices, two_rooms):
        # Schedule targets a specific room. After replace restore (rooms get fresh UUIDs), the target_id must remap.
        r1, _ = two_rooms
        await schedules_service.create_schedule(test_db, "RoomScoped", 0, [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], [{"target_type": "room", "target_id": r1.id, "state": {"dimming": 50}}], admin_user.id)
        envelope = await backup_service.export_all(test_db)
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope["data"], "replace", admin_user.id)
        # All rooms post-restore
        rooms_after = await devices_service.get_all_rooms(test_db)
        room_ids_after = {r.id for r in rooms_after}
        schedules_after = await schedules_service.get_all_schedules(test_db)
        rs = next(s for s in schedules_after if s.name == "RoomScoped")
        # The schedule's target_id must point to a room that exists in the current DB
        assert rs.targets[0].target_id in room_ids_after


class TestDevicesPhysicalInvariant:
    async def test_devices_not_wiped_when_backup_has_empty_devices_list_in_replace_mode(self, test_db, admin_user, sample_devices):
        # Replace mode wipes everything EXCEPT devices (devices are physical).
        before_count = len(await devices_service.get_all_devices(test_db))
        assert before_count == 5
        await backup_service.import_all(test_db, BACKUP_VERSION, _empty_backup_payload(), "replace", admin_user.id)
        after_count = len(await devices_service.get_all_devices(test_db))
        assert after_count == 5


class TestWebhookSecretSecurity:
    async def test_webhook_secret_hash_absent_from_export(self, test_db, admin_user, sample_devices):
        await schedules_service.create_schedule(test_db, "WebhookTrig", 0, [{"trigger_type": "webhook"}], [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        envelope = await backup_service.export_all(test_db)
        for sched in envelope["data"]["schedules"]:
            for trig in sched.get("triggers", []):
                assert "webhook_secret_hash" not in trig

    async def test_webhook_trigger_gets_fresh_hash_on_import(self, test_db, admin_user, sample_devices):
        await schedules_service.create_schedule(test_db, "Wh", 0, [{"trigger_type": "webhook"}], [{"target_type": "all", "state": {"dimming": 100}}], admin_user.id)
        original = await schedules_service.get_all_schedules(test_db)
        original_hash = original[0].triggers[0].webhook_secret_hash
        envelope = await backup_service.export_all(test_db)
        await backup_service.import_all(test_db, BACKUP_VERSION, envelope["data"], "replace", admin_user.id)
        restored = await schedules_service.get_all_schedules(test_db)
        new_hash = restored[0].triggers[0].webhook_secret_hash
        assert new_hash is not None
        assert new_hash != original_hash
