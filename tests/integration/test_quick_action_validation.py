"""API tests for Quick Action state validation at create/update/execute."""
import pytest
from unittest.mock import AsyncMock
from lighting_control.auth.dependencies import get_current_user
from lighting_control.quick_actions.service import create_quick_action


@pytest.fixture
def mock_control_device(monkeypatch):
    mock = AsyncMock(return_value={"state": True, "r": 100, "g": 50, "b": 25})
    monkeypatch.setattr("lighting_control.devices.discovery.control_device", mock)
    monkeypatch.setattr("lighting_control.quick_actions.router.control_device", mock)
    return mock


def _login(app, user):
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.mark.asyncio
async def test_create_with_pure_black_rgb_returns_422(app_client, admin_user, sample_devices):
    client, app = app_client
    _login(app, admin_user)
    payload = {"name": "Bad Black", "icon": None, "targets": [{"target_type": "all", "state": {"r": 0, "g": 0, "b": 0}}]}
    resp = await client.post("/api/quick-actions", json=payload)
    assert resp.status_code == 422
    assert "target[0]" in resp.json()["detail"]
    assert "(0,0,0)" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_update_with_combo_state_returns_422(app_client, admin_user, sample_devices, test_db):
    client, app = app_client
    _login(app, admin_user)
    qa = await create_quick_action(test_db, "Initial", None, [{"target_type": "all", "state": {"dimming": 50}}], admin_user.id)
    await test_db.commit()
    payload = {"name": "Initial", "icon": None, "targets": [{"target_type": "all", "state": {"r": 255, "g": 0, "b": 0, "temp": 3000}}]}
    resp = await client.put(f"/api/quick-actions/{qa.id}", json=payload)
    assert resp.status_code == 422
    assert "exactly one" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_execute_with_legacy_invalid_state_reports_failure_not_500(app_client, admin_user, sample_devices, test_db, mock_control_device):
    """A QA already in the DB with stored-invalid (0,0,0) state must execute gracefully."""
    client, app = app_client
    _login(app, admin_user)
    qa = await create_quick_action(test_db, "Legacy Bad", None, [
        {"target_type": "device", "target_id": sample_devices[0].id, "state": {"r": 0, "g": 0, "b": 0}},
        {"target_type": "device", "target_id": sample_devices[1].id, "state": {"dimming": 80}},
    ], admin_user.id)
    await test_db.commit()
    resp = await client.post(f"/api/quick-actions/{qa.id}/execute")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["executed"] is True
    assert any(f["target_index"] == 0 and "stored state invalid" in f["error"] for f in body["failures"])
    assert mock_control_device.await_count == 1
