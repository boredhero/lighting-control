"""Tests for the /auth/login response shape evolution (available_second_factors)."""
import os
import pytest
from lighting_control.auth.models import Passkey, TOTPSecret
from lighting_control.auth.service import decode_token


@pytest.mark.asyncio
async def test_login_no_second_factors_returns_full_tokens(app_client, admin_user):
    client, app = app_client
    resp = await client.post("/api/auth/login", json={"username": admin_user.username, "password": "testpass123"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["available_second_factors"] == []
    assert body["requires_totp"] is False
    assert body["requires_passkey"] is False
    assert body["partial_token"] is None


@pytest.mark.asyncio
async def test_login_with_totp_only_returns_partial_and_totp_factor(app_client, admin_user, test_db):
    client, app = app_client
    admin_user.totp_enabled = True
    test_db.add(TOTPSecret(user_id=admin_user.id, encrypted_secret="JBSWY3DPEHPK3PXP"))
    await test_db.flush()
    resp = await client.post("/api/auth/login", json={"username": admin_user.username, "password": "testpass123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available_second_factors"] == ["totp"]
    assert body["requires_totp"] is True
    assert body["requires_passkey"] is False
    assert body["access_token"] == ""
    assert body["partial_token"]
    payload = decode_token(body["partial_token"])
    assert payload["bridge_for"] == ["totp"]


@pytest.mark.asyncio
async def test_login_with_passkey_only_returns_partial_and_passkey_factor(app_client, admin_user, test_db):
    client, app = app_client
    test_db.add(Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="X"))
    await test_db.flush()
    resp = await client.post("/api/auth/login", json={"username": admin_user.username, "password": "testpass123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available_second_factors"] == ["passkey"]
    assert body["requires_totp"] is False
    assert body["requires_passkey"] is True
    payload = decode_token(body["partial_token"])
    assert payload["bridge_for"] == ["passkey"]


@pytest.mark.asyncio
async def test_login_with_both_returns_both_factors(app_client, admin_user, test_db):
    client, app = app_client
    admin_user.totp_enabled = True
    test_db.add(TOTPSecret(user_id=admin_user.id, encrypted_secret="JBSWY3DPEHPK3PXP"))
    test_db.add(Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="X"))
    await test_db.flush()
    resp = await client.post("/api/auth/login", json={"username": admin_user.username, "password": "testpass123"})
    assert resp.status_code == 200
    body = resp.json()
    assert set(body["available_second_factors"]) == {"totp", "passkey"}
    assert body["requires_totp"] is True
    assert body["requires_passkey"] is True
    payload = decode_token(body["partial_token"])
    assert set(payload["bridge_for"]) == {"totp", "passkey"}


@pytest.mark.asyncio
async def test_login_with_only_revoked_passkeys_does_not_offer_passkey(app_client, admin_user, test_db):
    from datetime import datetime, timezone
    client, app = app_client
    test_db.add(Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="Old", revoked_at=datetime.now(timezone.utc)))
    await test_db.flush()
    resp = await client.post("/api/auth/login", json={"username": admin_user.username, "password": "testpass123"})
    assert resp.status_code == 200
    body = resp.json()
    assert "passkey" not in body["available_second_factors"]
    assert body["requires_passkey"] is False


@pytest.mark.asyncio
async def test_login_invalid_credentials_returns_401(app_client, admin_user):
    client, app = app_client
    resp = await client.post("/api/auth/login", json={"username": admin_user.username, "password": "wrong"})
    assert resp.status_code == 401
