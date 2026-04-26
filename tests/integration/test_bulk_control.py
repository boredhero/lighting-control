"""API black-box tests for the upgraded /devices/bulk-control endpoint."""
import pytest
from unittest.mock import AsyncMock
from lighting_control.auth.dependencies import get_current_user


@pytest.fixture
def mock_control_device(monkeypatch):
    """Mocks discovery.control_device to return a successful pilotResult dict."""
    mock = AsyncMock(return_value={"state": True, "r": 255, "g": 0, "b": 0})
    monkeypatch.setattr("lighting_control.devices.discovery.control_device", mock)
    return mock


def _login(app, user):
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client):
    client, _ = app_client
    resp = await client.post("/api/devices/bulk-control", json={"device_ids": [], "state": {"dimming": 50}})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_legacy_device_ids_path_calls_control_for_each(app_client, sample_devices, admin_user, mock_control_device):
    client, app = app_client
    _login(app, admin_user)
    ids = [sample_devices[0].id, sample_devices[1].id]
    resp = await client.post("/api/devices/bulk-control", json={"device_ids": ids, "state": {"r": 255, "g": 0, "b": 0}})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success_count"] == 2
    assert body["failure_count"] == 0
    assert body["failures"] == []
    assert mock_control_device.await_count == 2


@pytest.mark.asyncio
async def test_target_type_room_resolves_room_devices_only(app_client, sample_devices, admin_user, mock_control_device, two_rooms):
    client, app = app_client
    _login(app, admin_user)
    r1, _ = two_rooms
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "room", "target_id": r1.id, "state": {"r": 255, "g": 0, "b": 0}})
    assert resp.status_code == 200, resp.text
    assert resp.json()["success_count"] == 2
    called_ips = sorted([call.args[0] for call in mock_control_device.await_args_list])
    assert called_ips == ["192.168.1.10", "192.168.1.11"]


@pytest.mark.asyncio
async def test_target_type_zone_resolves_zone_devices(app_client, sample_devices, admin_user, mock_control_device, one_zone):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "zone", "target_id": one_zone.id, "state": {"temp": 3000}})
    assert resp.status_code == 200, resp.text
    assert resp.json()["success_count"] == 2


@pytest.mark.asyncio
async def test_target_type_group_resolves_group_members(app_client, sample_devices, admin_user, mock_control_device, one_group):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "group", "target_id": one_group.id, "state": {"r": 255, "g": 0, "b": 0}})
    assert resp.status_code == 200
    assert resp.json()["success_count"] == 2


@pytest.mark.asyncio
async def test_target_type_all_calls_every_device(app_client, sample_devices, admin_user, mock_control_device):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "all", "state": {"r": 255, "g": 0, "b": 0}})
    assert resp.status_code == 200
    assert resp.json()["success_count"] == 5


@pytest.mark.asyncio
async def test_target_type_all_except_excludes_listed_ids(app_client, sample_devices, admin_user, mock_control_device):
    client, app = app_client
    _login(app, admin_user)
    excluded_ip = sample_devices[4].ip
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "all_except", "exclude_device_ids": [sample_devices[4].id], "state": {"r": 255, "g": 0, "b": 0}})
    assert resp.status_code == 200
    assert resp.json()["success_count"] == 4
    called_ips = [call.args[0] for call in mock_control_device.await_args_list]
    assert excluded_ip not in called_ips


@pytest.mark.asyncio
async def test_empty_resolved_device_list_returns_zero_zero(app_client, sample_devices, admin_user, mock_control_device):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/devices/bulk-control", json={"device_ids": [], "state": {"dimming": 50}})
    assert resp.status_code == 200
    assert resp.json() == {"success_count": 0, "failure_count": 0, "failures": []}
    assert mock_control_device.await_count == 0


@pytest.mark.asyncio
async def test_unknown_device_id_skipped(app_client, sample_devices, admin_user, mock_control_device):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/devices/bulk-control", json={"device_ids": ["nonexistent"], "state": {"dimming": 50}})
    assert resp.status_code == 200
    assert resp.json()["success_count"] == 0
    assert mock_control_device.await_count == 0


@pytest.mark.asyncio
async def test_neither_device_ids_nor_target_type_returns_422(app_client, admin_user, mock_control_device):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/devices/bulk-control", json={"state": {"dimming": 50}})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_both_device_ids_and_target_type_returns_422(app_client, admin_user, mock_control_device):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/devices/bulk-control", json={"device_ids": ["x"], "target_type": "all", "state": {"dimming": 50}})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_state_validation_rejects_pure_black_before_fanout(app_client, sample_devices, admin_user, mock_control_device):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "all", "state": {"r": 0, "g": 0, "b": 0}})
    assert resp.status_code == 422
    assert mock_control_device.await_count == 0


@pytest.mark.asyncio
async def test_state_validation_rejects_combos_before_fanout(app_client, sample_devices, admin_user, mock_control_device):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "all", "state": {"r": 255, "g": 0, "b": 0, "temp": 3000}})
    assert resp.status_code == 422
    assert mock_control_device.await_count == 0


@pytest.mark.asyncio
async def test_near_black_rgb_clamped_then_sent(app_client, sample_devices, admin_user, mock_control_device, two_rooms):
    client, app = app_client
    _login(app, admin_user)
    r1, _ = two_rooms
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "room", "target_id": r1.id, "state": {"r": 5, "g": 5, "b": 5}})
    assert resp.status_code == 200
    sent = mock_control_device.await_args_list[0].args[1]
    assert sent.get("r") == 24 and sent.get("g") == 24 and sent.get("b") == 24


@pytest.mark.asyncio
async def test_turn_off_strips_other_keys_before_fanout(app_client, sample_devices, admin_user, mock_control_device, two_rooms):
    client, app = app_client
    _login(app, admin_user)
    r1, _ = two_rooms
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "room", "target_id": r1.id, "state": {"turn_off": True, "r": 255, "g": 0, "b": 0}})
    assert resp.status_code == 200
    sent = mock_control_device.await_args_list[0].args[1]
    assert sent == {"turn_off": True}


@pytest.mark.asyncio
async def test_partial_failures_reported_with_device_ids(app_client, sample_devices, admin_user, monkeypatch, two_rooms):
    """One device returns None (no response), the other succeeds."""
    client, app = app_client
    _login(app, admin_user)
    r1, _ = two_rooms
    call_count = {"n": 0}
    async def fake(ip, state):
        call_count["n"] += 1
        return {"state": True} if call_count["n"] == 1 else None
    monkeypatch.setattr("lighting_control.devices.discovery.control_device", fake)
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "room", "target_id": r1.id, "state": {"r": 255, "g": 0, "b": 0}})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success_count"] == 1
    assert body["failure_count"] == 1
    assert len(body["failures"]) == 1
    assert "device_id" in body["failures"][0]
    assert "error" in body["failures"][0]


@pytest.mark.asyncio
async def test_all_failures_still_returns_200(app_client, sample_devices, admin_user, monkeypatch, two_rooms):
    """Mock raises for every call; gather should not bubble; response is 200 with all failures."""
    client, app = app_client
    _login(app, admin_user)
    r1, _ = two_rooms
    async def boom(ip, state):
        raise TimeoutError(f"timeout reaching {ip}")
    monkeypatch.setattr("lighting_control.devices.discovery.control_device", boom)
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "room", "target_id": r1.id, "state": {"r": 255, "g": 0, "b": 0}})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success_count"] == 0
    assert body["failure_count"] == 2
    for f in body["failures"]:
        assert "timeout reaching" in f["error"]


@pytest.mark.asyncio
async def test_guest_with_control_permission_can_use_bulk(app_client, sample_devices, guest_user, mock_control_device, two_rooms):
    client, app = app_client
    _login(app, guest_user)
    r1, _ = two_rooms
    resp = await client.post("/api/devices/bulk-control", json={"target_type": "room", "target_id": r1.id, "state": {"dimming": 80}})
    assert resp.status_code == 200
    assert resp.json()["success_count"] == 2
