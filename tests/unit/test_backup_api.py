"""HTTP endpoint tests for /api/backup — auth gating and response shape."""
from lighting_control.auth.dependencies import get_current_user


class TestBackupAPI:
    async def test_export_returns_envelope_with_version_and_data(self, app_client, admin_user, sample_devices):
        client, app = app_client
        app.dependency_overrides[get_current_user] = lambda: admin_user
        resp = await client.get("/api/backup/export")
        assert resp.status_code == 200
        body = resp.json()
        assert body["version"] == 1
        assert "exported_at" in body
        assert "data" in body
        assert "devices" in body["data"]
        assert "hierarchy" in body["data"]
        assert "schedules" in body["data"]
        assert "quick_actions" in body["data"]
        assert "scenes" in body["data"]
        assert len(body["data"]["devices"]) == 5

    async def test_import_without_can_manage_devices_returns_403(self, app_client, guest_user):
        client, app = app_client
        # Strip can_manage_devices from the guest user's permissions
        guest_user.permissions = dict(guest_user.permissions or {})
        guest_user.permissions["can_manage_devices"] = False
        app.dependency_overrides[get_current_user] = lambda: guest_user
        payload = {"version": 1, "data": {"devices": [], "hierarchy": {"rooms": [], "groups": []}, "schedules": [], "quick_actions": [], "scenes": []}, "mode": "merge"}
        resp = await client.post("/api/backup/import", json=payload)
        assert resp.status_code == 403
        assert "can_manage_devices" in resp.json()["detail"]

    async def test_import_with_admin_returns_200_and_counts(self, app_client, admin_user, sample_devices):
        client, app = app_client
        app.dependency_overrides[get_current_user] = lambda: admin_user
        payload = {
            "version": 1,
            "data": {
                "devices": [],
                "hierarchy": {"rooms": [], "groups": []},
                "schedules": [{"id": "s-uuid-1", "name": "FromAPI", "enabled": True, "priority": 0, "triggers": [{"trigger_type": "cron", "cron_expression": "0 0 * * *"}], "targets": [{"target_type": "all", "state": {"dimming": 50}}]}],
                "quick_actions": [],
                "scenes": [],
            },
            "mode": "merge",
        }
        resp = await client.post("/api/backup/import", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["schedules"]["created"] == 1
