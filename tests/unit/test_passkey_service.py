"""Unit tests for the passkey service layer."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from lighting_control.auth import passkeys
from lighting_control.auth.models import Passkey, User, WebAuthnChallenge


@pytest.mark.asyncio
async def test_persist_and_delete_challenge_roundtrip(test_db, admin_user):
    sid = passkeys.new_session_id()
    await passkeys._persist_challenge(test_db, session_id=sid, challenge=b"x" * 32, kind="register", user_id=admin_user.id)
    row = (await test_db.execute(select(WebAuthnChallenge).where(WebAuthnChallenge.session_id == sid))).scalar_one_or_none()
    assert row is not None and row.kind == "register"
    deleted = await passkeys._delete_challenge(test_db, sid)
    assert deleted is not None
    after = (await test_db.execute(select(WebAuthnChallenge).where(WebAuthnChallenge.session_id == sid))).scalar_one_or_none()
    assert after is None


@pytest.mark.asyncio
async def test_delete_challenge_returns_none_when_missing(test_db):
    result = await passkeys._delete_challenge(test_db, "no-such-session-id")
    assert result is None


@pytest.mark.asyncio
async def test_cleanup_expired_challenges_deletes_only_expired(test_db, admin_user):
    fresh_id = passkeys.new_session_id()
    await passkeys._persist_challenge(test_db, session_id=fresh_id, challenge=b"f" * 32, kind="register", user_id=admin_user.id)
    expired = WebAuthnChallenge(session_id=passkeys.new_session_id(), challenge=b"e" * 32, kind="register", user_id=admin_user.id, expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))
    test_db.add(expired)
    await test_db.flush()
    deleted = await passkeys.cleanup_expired_challenges(test_db)
    assert deleted == 1
    remaining = (await test_db.execute(select(WebAuthnChallenge))).scalars().all()
    assert len(list(remaining)) == 1


def test_derive_device_type_multi():
    assert passkeys._derive_device_type("CredentialDeviceType.MULTI_DEVICE") == "multiDevice"
    assert passkeys._derive_device_type("multi_device") == "multiDevice"


def test_derive_device_type_single_default():
    assert passkeys._derive_device_type("CredentialDeviceType.SINGLE_DEVICE") == "singleDevice"
    assert passkeys._derive_device_type("anything-else") == "singleDevice"


def test_derive_non_uv_only_uv_true_is_false():
    assert passkeys._derive_non_uv_only(True, ["usb"]) is False
    assert passkeys._derive_non_uv_only(True, []) is False


def test_derive_non_uv_only_uv_false_internal_is_false():
    assert passkeys._derive_non_uv_only(False, ["internal"]) is False


def test_derive_non_uv_only_uv_false_cross_platform_is_true():
    assert passkeys._derive_non_uv_only(False, ["usb", "nfc"]) is True
    assert passkeys._derive_non_uv_only(False, []) is True


def test_fake_credential_ids_deterministic_per_username():
    a = passkeys._fake_credential_ids("alice")
    b = passkeys._fake_credential_ids("alice")
    c = passkeys._fake_credential_ids("bob")
    assert a == b
    assert a != c
    assert all(isinstance(x, bytes) and len(x) == 32 for x in a)


def test_transports_from_credential_filters_unknown():
    assert passkeys._transports_from_credential({"response": {"transports": ["usb", "made-up"]}}) == ["usb"]
    assert passkeys._transports_from_credential({"response": {}}) == []
    assert passkeys._transports_from_credential({}) == []


@pytest.mark.asyncio
async def test_soft_revoke_sets_revoked_at(test_db, admin_user):
    pk = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="X", device_type="singleDevice")
    test_db.add(pk)
    await test_db.flush()
    ok = await passkeys.soft_revoke_passkey(test_db, pk.id, admin_user.id)
    assert ok is True
    await test_db.refresh(pk)
    assert pk.revoked_at is not None


@pytest.mark.asyncio
async def test_soft_revoke_returns_false_for_other_user(test_db, admin_user, guest_user):
    pk = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="X")
    test_db.add(pk)
    await test_db.flush()
    ok = await passkeys.soft_revoke_passkey(test_db, pk.id, guest_user.id)
    assert ok is False


@pytest.mark.asyncio
async def test_soft_revoke_idempotent_already_revoked(test_db, admin_user):
    pk = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="X", revoked_at=datetime.now(timezone.utc))
    test_db.add(pk)
    await test_db.flush()
    ok = await passkeys.soft_revoke_passkey(test_db, pk.id, admin_user.id)
    assert ok is False


@pytest.mark.asyncio
async def test_rename_passkey_sets_name(test_db, admin_user):
    pk = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="Old")
    test_db.add(pk)
    await test_db.flush()
    out = await passkeys.rename_passkey(test_db, pk.id, admin_user.id, "New Name")
    assert out is not None and out.name == "New Name"


@pytest.mark.asyncio
async def test_rename_passkey_truncates_at_64(test_db, admin_user):
    pk = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="Old")
    test_db.add(pk)
    await test_db.flush()
    long_name = "x" * 200
    out = await passkeys.rename_passkey(test_db, pk.id, admin_user.id, long_name)
    assert out is not None and len(out.name) == 64


@pytest.mark.asyncio
async def test_list_user_passkeys_excludes_revoked(test_db, admin_user):
    a = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="A")
    b = Passkey(user_id=admin_user.id, credential_id=os.urandom(16), public_key=b"pk", name="B", revoked_at=datetime.now(timezone.utc))
    test_db.add_all([a, b])
    await test_db.flush()
    out = await passkeys.list_user_passkeys(test_db, admin_user.id)
    assert len(out) == 1 and out[0].name == "A"
