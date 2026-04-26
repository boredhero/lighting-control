"""Integration tests for passkey registration and authentication endpoints."""
import os
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from sqlalchemy import select

from lighting_control.auth import passkeys as passkey_service
from lighting_control.auth.dependencies import get_current_user
from lighting_control.auth.models import Passkey, User, WebAuthnChallenge
from lighting_control.auth.service import create_partial_token


def _login(app, user):
    app.dependency_overrides[get_current_user] = lambda: user


def _verified_registration(credential_id: bytes, *, public_key: bytes = b"pubkey-bytes", sign_count: int = 0, aaguid: str | None = "00000000-0000-0000-0000-000000000000", user_verified: bool = True, multi_device: bool = False, backed_up: bool = False):
    obj = MagicMock()
    obj.credential_id = credential_id
    obj.credential_public_key = public_key
    obj.sign_count = sign_count
    obj.aaguid = aaguid
    obj.fmt = "none"
    obj.credential_device_type = "MULTI_DEVICE" if multi_device else "SINGLE_DEVICE"
    obj.credential_backed_up = backed_up
    obj.user_verified = user_verified
    obj.attestation_object = b"\x00"
    return obj


def _verified_authentication(*, new_sign_count: int = 1, multi_device: bool = False, backed_up: bool = False, user_verified: bool = True):
    obj = MagicMock()
    obj.new_sign_count = new_sign_count
    obj.credential_device_type = "MULTI_DEVICE" if multi_device else "SINGLE_DEVICE"
    obj.credential_backed_up = backed_up
    obj.user_verified = user_verified
    return obj


def _credential_json(credential_id: bytes, transports=None):
    from webauthn.helpers import bytes_to_base64url
    return {
        "id": bytes_to_base64url(credential_id),
        "rawId": bytes_to_base64url(credential_id),
        "type": "public-key",
        "response": {
            "clientDataJSON": "e30=",
            "attestationObject": "e30=",
            "transports": transports or ["usb"],
        },
        "clientExtensionResults": {},
    }


def _auth_credential_json(credential_id: bytes):
    from webauthn.helpers import bytes_to_base64url
    return {
        "id": bytes_to_base64url(credential_id),
        "rawId": bytes_to_base64url(credential_id),
        "type": "public-key",
        "response": {
            "clientDataJSON": "e30=",
            "authenticatorData": "e30=",
            "signature": "e30=",
            "userHandle": None,
        },
        "clientExtensionResults": {},
    }


@pytest.mark.asyncio
async def test_register_start_requires_auth(app_client):
    client, app = app_client
    resp = await client.post("/api/auth/me/passkeys/register/start")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_register_start_returns_options_and_sets_cookie(app_client, admin_user):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/auth/me/passkeys/register/start")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "options" in body and "session_id" in body
    assert body["options"]["rp"]["id"] == "lights.martinospizza.dev"
    assert resp.cookies.get("webauthn_session") == body["session_id"]


@pytest.mark.asyncio
async def test_register_finish_without_cookie_returns_400(app_client, admin_user, test_db):
    client, app = app_client
    _login(app, admin_user)
    resp = await client.post("/api/auth/me/passkeys/register/finish", json={"credential": {}, "name": "X", "session_id": "no-such"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_register_finish_with_mismatched_cookie_returns_400(app_client, admin_user):
    client, app = app_client
    _login(app, admin_user)
    client.cookies.set("webauthn_session", "different-session-id")
    resp = await client.post("/api/auth/me/passkeys/register/finish", json={"credential": {}, "name": "X", "session_id": "claimed-session-id"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_register_finish_with_no_challenge_row_returns_400(app_client, admin_user):
    client, app = app_client
    _login(app, admin_user)
    sid = "a" * 64
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/me/passkeys/register/finish", json={"credential": {}, "name": "X", "session_id": sid})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_register_finish_happy_path(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    _login(app, admin_user)
    cred_id = os.urandom(32)
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_registration_response", lambda **kw: _verified_registration(cred_id))
    start = await client.post("/api/auth/me/passkeys/register/start")
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    finish = await client.post("/api/auth/me/passkeys/register/finish", json={"credential": _credential_json(cred_id), "name": "Test Key", "session_id": sid})
    assert finish.status_code == 201, finish.text
    body = finish.json()
    assert body["name"] == "Test Key"
    assert body["non_uv_only"] is False
    rows = (await test_db.execute(select(Passkey).where(Passkey.user_id == admin_user.id))).scalars().all()
    assert len(list(rows)) == 1


@pytest.mark.asyncio
async def test_register_finish_uv_zero_cross_platform_sets_non_uv_only(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    _login(app, admin_user)
    cred_id = os.urandom(32)
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_registration_response", lambda **kw: _verified_registration(cred_id, user_verified=False))
    start = await client.post("/api/auth/me/passkeys/register/start")
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    cred = _credential_json(cred_id, transports=["usb"])
    finish = await client.post("/api/auth/me/passkeys/register/finish", json={"credential": cred, "name": "YubiKey", "session_id": sid})
    assert finish.status_code == 201
    assert finish.json()["non_uv_only"] is True


@pytest.mark.asyncio
async def test_register_finish_uv_zero_internal_transport_is_not_non_uv_only(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    _login(app, admin_user)
    cred_id = os.urandom(32)
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_registration_response", lambda **kw: _verified_registration(cred_id, user_verified=False))
    start = await client.post("/api/auth/me/passkeys/register/start")
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    cred = _credential_json(cred_id, transports=["internal"])
    finish = await client.post("/api/auth/me/passkeys/register/finish", json={"credential": cred, "name": "Phone", "session_id": sid})
    assert finish.status_code == 201
    assert finish.json()["non_uv_only"] is False


@pytest.mark.asyncio
async def test_register_finish_duplicate_credential_id_returns_generic_400(app_client, admin_user, guest_user, test_db, monkeypatch):
    client, app = app_client
    cred_id = os.urandom(32)
    pk = Passkey(user_id=guest_user.id, credential_id=cred_id, public_key=b"pk", name="GuestKey")
    test_db.add(pk)
    await test_db.flush()
    _login(app, admin_user)
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_registration_response", lambda **kw: _verified_registration(cred_id))
    start = await client.post("/api/auth/me/passkeys/register/start")
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    finish = await client.post("/api/auth/me/passkeys/register/finish", json={"credential": _credential_json(cred_id), "name": "Mine", "session_id": sid})
    assert finish.status_code == 400
    assert "already" in finish.json()["detail"].lower() or "could not" in finish.json()["detail"].lower()
    rows = (await test_db.execute(select(WebAuthnChallenge).where(WebAuthnChallenge.session_id == sid))).scalars().all()
    assert len(list(rows)) == 0


@pytest.mark.asyncio
async def test_register_finish_uv_upgrade_revokes_non_uv_only_sibling(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    _login(app, admin_user)
    aaguid = "11111111-2222-3333-4444-555555555555"
    old_cred = os.urandom(32)
    old = Passkey(user_id=admin_user.id, credential_id=old_cred, public_key=b"pk", name="Old", aaguid=aaguid, non_uv_only=True)
    test_db.add(old)
    await test_db.flush()
    new_cred = os.urandom(32)
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_registration_response", lambda **kw: _verified_registration(new_cred, aaguid=aaguid, user_verified=True))
    start = await client.post("/api/auth/me/passkeys/register/start")
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    finish = await client.post("/api/auth/me/passkeys/register/finish", json={"credential": _credential_json(new_cred), "name": "Upgraded", "session_id": sid})
    assert finish.status_code == 201
    await test_db.refresh(old)
    assert old.revoked_at is not None


@pytest.mark.asyncio
async def test_list_passkeys_excludes_revoked(app_client, admin_user, test_db):
    client, app = app_client
    a = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="Active")
    b = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="Revoked", revoked_at=datetime.now(timezone.utc))
    test_db.add_all([a, b])
    await test_db.flush()
    _login(app, admin_user)
    resp = await client.get("/api/auth/me/passkeys")
    assert resp.status_code == 200
    names = {p["name"] for p in resp.json()}
    assert names == {"Active"}


@pytest.mark.asyncio
async def test_patch_rename_happy_path(app_client, admin_user, test_db):
    client, app = app_client
    pk = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="Old")
    test_db.add(pk)
    await test_db.flush()
    _login(app, admin_user)
    resp = await client.patch(f"/api/auth/me/passkeys/{pk.id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


@pytest.mark.asyncio
async def test_patch_rename_other_users_passkey_returns_404(app_client, admin_user, guest_user, test_db):
    client, app = app_client
    pk = Passkey(user_id=guest_user.id, credential_id=os.urandom(16), public_key=b"pk", name="Other")
    test_db.add(pk)
    await test_db.flush()
    _login(app, admin_user)
    resp = await client.patch(f"/api/auth/me/passkeys/{pk.id}", json={"name": "Hijack"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_is_soft_revoke(app_client, admin_user, test_db):
    client, app = app_client
    pk = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="X")
    test_db.add(pk)
    await test_db.flush()
    _login(app, admin_user)
    resp = await client.delete(f"/api/auth/me/passkeys/{pk.id}")
    assert resp.status_code == 204
    await test_db.refresh(pk)
    assert pk.revoked_at is not None


@pytest.mark.asyncio
async def test_login_passkey_start_unknown_user_returns_fake_credentials(app_client, test_db):
    client, app = app_client
    resp = await client.post("/api/auth/login/passkey/start", json={"username": "ghost-user-no-such"})
    assert resp.status_code == 200
    body = resp.json()
    assert "options" in body
    allow = body["options"].get("allowCredentials") or []
    assert len(allow) >= 1


@pytest.mark.asyncio
async def test_login_passkey_start_known_user_with_no_passkeys_returns_fake_credentials(app_client, admin_user):
    client, app = app_client
    resp = await client.post("/api/auth/login/passkey/start", json={"username": admin_user.username})
    assert resp.status_code == 200
    allow = resp.json()["options"].get("allowCredentials") or []
    assert len(allow) >= 1


@pytest.mark.asyncio
async def test_login_passkey_finish_without_cookie_returns_400(app_client):
    client, app = app_client
    resp = await client.post("/api/auth/login/passkey/finish", json={"credential": {}, "session_id": "abc"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_login_passkey_finish_revoked_credential_returns_401(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    cred_id = os.urandom(32)
    pk = Passkey(user_id=admin_user.id, credential_id=cred_id, public_key=b"pk", name="X", revoked_at=datetime.now(timezone.utc))
    test_db.add(pk)
    await test_db.flush()
    start = await client.post("/api/auth/login/passkey/start", json={})
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/login/passkey/finish", json={"credential": _auth_credential_json(cred_id), "session_id": sid})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_passkey_finish_happy_path(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    cred_id = os.urandom(32)
    pk = Passkey(user_id=admin_user.id, credential_id=cred_id, public_key=b"pk", name="X", device_type="multiDevice", sign_count=0)
    test_db.add(pk)
    await test_db.flush()
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_authentication_response", lambda **kw: _verified_authentication(new_sign_count=1, multi_device=True))
    start = await client.post("/api/auth/login/passkey/start", json={"username": admin_user.username})
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/login/passkey/finish", json={"credential": _auth_credential_json(cred_id), "session_id": sid})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"] and body["refresh_token"]


@pytest.mark.asyncio
async def test_login_passkey_finish_non_uv_without_partial_token_returns_401(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    cred_id = os.urandom(32)
    pk = Passkey(user_id=admin_user.id, credential_id=cred_id, public_key=b"pk", name="YubiKey", non_uv_only=True, device_type="singleDevice", sign_count=0)
    test_db.add(pk)
    await test_db.flush()
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_authentication_response", lambda **kw: _verified_authentication(new_sign_count=1))
    start = await client.post("/api/auth/login/passkey/start", json={"username": admin_user.username})
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/login/passkey/finish", json={"credential": _auth_credential_json(cred_id), "session_id": sid})
    assert resp.status_code == 401
    assert "second factor" in resp.json()["detail"].lower() or "password" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_passkey_finish_non_uv_with_valid_partial_token_succeeds(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    cred_id = os.urandom(32)
    pk = Passkey(user_id=admin_user.id, credential_id=cred_id, public_key=b"pk", name="YubiKey", non_uv_only=True, device_type="singleDevice", sign_count=0)
    test_db.add(pk)
    await test_db.flush()
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_authentication_response", lambda **kw: _verified_authentication(new_sign_count=1))
    partial = create_partial_token(admin_user.id, bridge_for=["passkey"])
    start = await client.post("/api/auth/login/passkey/start", json={"username": admin_user.username, "partial_token": partial})
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/login/passkey/finish", json={"credential": _auth_credential_json(cred_id), "session_id": sid, "partial_token": partial})
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_login_passkey_finish_non_uv_with_partial_token_for_different_user_returns_401(app_client, admin_user, guest_user, test_db, monkeypatch):
    client, app = app_client
    cred_id = os.urandom(32)
    pk = Passkey(user_id=admin_user.id, credential_id=cred_id, public_key=b"pk", name="X", non_uv_only=True, device_type="singleDevice")
    test_db.add(pk)
    await test_db.flush()
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_authentication_response", lambda **kw: _verified_authentication(new_sign_count=1))
    wrong_partial = create_partial_token(guest_user.id, bridge_for=["passkey"])
    start = await client.post("/api/auth/login/passkey/start", json={"username": admin_user.username, "partial_token": wrong_partial})
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/login/passkey/finish", json={"credential": _auth_credential_json(cred_id), "session_id": sid, "partial_token": wrong_partial})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_partial_token_for_totp_only_rejected_at_passkey_finish(app_client, admin_user, test_db):
    client, app = app_client
    partial = create_partial_token(admin_user.id, bridge_for=["totp"])
    resp = await client.post("/api/auth/login/passkey/start", json={"partial_token": partial})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_partial_token_for_passkey_only_rejected_at_totp_finish(app_client, admin_user, test_db):
    client, app = app_client
    partial = create_partial_token(admin_user.id, bridge_for=["passkey"])
    resp = await client.post("/api/auth/login/totp", json={"code": "000000", "partial_token": partial})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_passkey_finish_signcount_regression_warns_first(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    cred_id = os.urandom(32)
    pk = Passkey(user_id=admin_user.id, credential_id=cred_id, public_key=b"pk", name="X", device_type="singleDevice", sign_count=10)
    test_db.add(pk)
    await test_db.flush()
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_authentication_response", lambda **kw: _verified_authentication(new_sign_count=5))
    start = await client.post("/api/auth/login/passkey/start", json={"username": admin_user.username})
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/login/passkey/finish", json={"credential": _auth_credential_json(cred_id), "session_id": sid})
    assert resp.status_code == 401
    await test_db.refresh(pk)
    assert pk.last_regression_at is not None
    assert pk.revoked_at is None


@pytest.mark.asyncio
async def test_login_passkey_finish_signcount_regression_revokes_after_second_within_24h(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    cred_id = os.urandom(32)
    pk = Passkey(user_id=admin_user.id, credential_id=cred_id, public_key=b"pk", name="X", device_type="singleDevice", sign_count=10, last_regression_at=datetime.now(timezone.utc) - timedelta(minutes=5))
    test_db.add(pk)
    await test_db.flush()
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_authentication_response", lambda **kw: _verified_authentication(new_sign_count=5))
    start = await client.post("/api/auth/login/passkey/start", json={"username": admin_user.username})
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/login/passkey/finish", json={"credential": _auth_credential_json(cred_id), "session_id": sid})
    assert resp.status_code == 401
    await test_db.refresh(pk)
    assert pk.revoked_at is not None


@pytest.mark.asyncio
async def test_login_passkey_finish_multidevice_skips_signcount_check(app_client, admin_user, test_db, monkeypatch):
    client, app = app_client
    cred_id = os.urandom(32)
    pk = Passkey(user_id=admin_user.id, credential_id=cred_id, public_key=b"pk", name="X", device_type="multiDevice", sign_count=10)
    test_db.add(pk)
    await test_db.flush()
    monkeypatch.setattr("lighting_control.auth.passkeys.webauthn.verify_authentication_response", lambda **kw: _verified_authentication(new_sign_count=5, multi_device=True))
    start = await client.post("/api/auth/login/passkey/start", json={"username": admin_user.username})
    sid = start.json()["session_id"]
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/login/passkey/finish", json={"credential": _auth_credential_json(cred_id), "session_id": sid})
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_register_finish_wrong_kind_returns_400(app_client, admin_user, test_db):
    client, app = app_client
    _login(app, admin_user)
    sid = passkey_service.new_session_id()
    row = WebAuthnChallenge(session_id=sid, challenge=b"x" * 32, kind="authenticate", user_id=admin_user.id, expires_at=datetime.now(timezone.utc) + timedelta(seconds=120))
    test_db.add(row)
    await test_db.flush()
    client.cookies.set("webauthn_session", sid)
    resp = await client.post("/api/auth/me/passkeys/register/finish", json={"credential": {}, "name": "X", "session_id": sid})
    assert resp.status_code == 400
