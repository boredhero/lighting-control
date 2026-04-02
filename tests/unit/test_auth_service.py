"""Tests for the auth service — password hashing, JWT, sessions, permissions."""
import hashlib
import time
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from jose import jwt
from lighting_control.auth.service import (
    ALGORITHM, create_access_token, create_partial_token, create_refresh_token,
    create_session, create_user, decode_token, get_user_by_username,
    hash_password, hash_token, is_setup_complete, is_token_revoked,
    mark_setup_complete, revoke_user_sessions, verify_password,
    create_invite, get_invite, use_invite, create_api_key, get_api_key_by_hash,
)
from lighting_control.auth.totp import generate_totp_secret, get_totp_uri, verify_totp_code
from lighting_control.config import settings


class TestPasswordHashing:
    def test_hash_uses_argon2id(self):
        h = hash_password("mypassword")
        assert h.startswith("$argon2id$"), f"Expected argon2id hash, got: {h[:20]}"

    def test_verify_correct_password(self):
        h = hash_password("correcthorse")
        assert verify_password("correcthorse", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("correcthorse")
        assert verify_password("wrongpassword", h) is False

    def test_verify_empty_password(self):
        h = hash_password("something")
        assert verify_password("", h) is False

    def test_different_passwords_different_hashes(self):
        h1 = hash_password("password1")
        h2 = hash_password("password2")
        assert h1 != h2

    def test_same_password_different_salts(self):
        h1 = hash_password("samepassword")
        h2 = hash_password("samepassword")
        assert h1 != h2, "argon2id should produce different hashes due to random salt"


class TestJWT:
    def test_access_token_contains_correct_claims(self):
        user_id = str(uuid.uuid4())
        token = create_access_token(user_id, True, {"can_control_devices": True})
        payload = decode_token(token)
        assert payload["sub"] == user_id
        assert payload["type"] == "access"
        assert payload["is_admin"] is True
        assert payload["permissions"]["can_control_devices"] is True

    def test_refresh_token_contains_correct_claims(self):
        user_id = str(uuid.uuid4())
        token = create_refresh_token(user_id)
        payload = decode_token(token)
        assert payload["sub"] == user_id
        assert payload["type"] == "refresh"
        assert "jti" in payload

    def test_partial_token_contains_correct_claims(self):
        user_id = str(uuid.uuid4())
        token = create_partial_token(user_id)
        payload = decode_token(token)
        assert payload["sub"] == user_id
        assert payload["type"] == "partial"

    def test_expired_token_raises(self):
        payload = {"sub": "user123", "exp": datetime.now(timezone.utc) - timedelta(seconds=10), "type": "access"}
        token = jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)
        with pytest.raises(Exception):
            decode_token(token)

    def test_tampered_token_raises(self):
        token = create_access_token("user123", False, {})
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(Exception):
            decode_token(tampered)

    def test_wrong_secret_raises(self):
        payload = {"sub": "user123", "exp": datetime.now(timezone.utc) + timedelta(hours=1), "type": "access"}
        token = jwt.encode(payload, "wrong-secret", algorithm=ALGORITHM)
        with pytest.raises(Exception):
            decode_token(token)


class TestTokenHash:
    def test_hash_token_is_sha256(self):
        raw = "my-secret-token"
        expected = hashlib.sha256(raw.encode()).hexdigest()
        assert hash_token(raw) == expected

    def test_hash_token_deterministic(self):
        assert hash_token("abc") == hash_token("abc")

    def test_hash_token_different_inputs(self):
        assert hash_token("token1") != hash_token("token2")


class TestSetupFuse:
    async def test_setup_not_complete_initially(self, test_db):
        assert await is_setup_complete(test_db) is False

    async def test_setup_complete_after_marking(self, test_db):
        await mark_setup_complete(test_db)
        assert await is_setup_complete(test_db) is True


class TestUserCreation:
    async def test_create_admin(self, test_db):
        user = await create_user(test_db, "newadmin", "password123", is_admin=True)
        assert user.username == "newadmin"
        assert user.is_admin is True
        assert user.is_guest is False
        assert verify_password("password123", user.password_hash) is True

    async def test_create_guest_with_expiry(self, test_db):
        expires = datetime.now(timezone.utc) + timedelta(hours=12)
        user = await create_user(test_db, "tempguest", "guestpass", is_guest=True, guest_expires_at=expires)
        assert user.is_guest is True
        assert user.guest_expires_at == expires

    async def test_get_user_by_username(self, test_db, admin_user):
        found = await get_user_by_username(test_db, "admin")
        assert found is not None
        assert found.id == admin_user.id

    async def test_get_user_by_username_not_found(self, test_db):
        found = await get_user_by_username(test_db, "nonexistent")
        assert found is None


class TestSessionRevocation:
    async def test_token_not_revoked_after_creation(self, test_db, admin_user):
        access = create_access_token(admin_user.id, True, {})
        refresh = create_refresh_token(admin_user.id)
        await create_session(test_db, admin_user.id, access, refresh)
        assert await is_token_revoked(test_db, access) is False

    async def test_token_revoked_after_revocation(self, test_db, admin_user):
        access = create_access_token(admin_user.id, True, {})
        refresh = create_refresh_token(admin_user.id)
        await create_session(test_db, admin_user.id, access, refresh)
        await revoke_user_sessions(test_db, admin_user.id)
        assert await is_token_revoked(test_db, access) is True

    async def test_unknown_token_is_revoked(self, test_db):
        assert await is_token_revoked(test_db, "totally-unknown-token") is True


class TestInviteCodes:
    async def test_create_and_get_invite(self, test_db, admin_user, user_role):
        invite = await create_invite(test_db, admin_user.id, role_id=user_role.id)
        assert invite.code is not None
        assert invite.used is False
        found = await get_invite(test_db, invite.code)
        assert found is not None
        assert found.id == invite.id

    async def test_used_invite_not_found(self, test_db, admin_user, user_role):
        invite = await create_invite(test_db, admin_user.id, role_id=user_role.id)
        await use_invite(test_db, invite, admin_user.id)
        found = await get_invite(test_db, invite.code)
        assert found is None, "Used invite should not be retrievable"

    async def test_invalid_code_returns_none(self, test_db):
        found = await get_invite(test_db, "nonexistent-code")
        assert found is None


class TestAPIKeys:
    async def test_create_api_key_returns_raw_and_hashed(self, test_db, admin_user):
        api_key, raw_key = await create_api_key(test_db, admin_user.id, "My Key", {})
        assert len(raw_key) > 20
        assert api_key.key_hash == hash_token(raw_key)

    async def test_find_api_key_by_hash(self, test_db, admin_user):
        api_key, raw_key = await create_api_key(test_db, admin_user.id, "Test", {})
        found = await get_api_key_by_hash(test_db, hash_token(raw_key))
        assert found is not None
        assert found.id == api_key.id

    async def test_wrong_hash_returns_none(self, test_db):
        found = await get_api_key_by_hash(test_db, "0" * 64)
        assert found is None


class TestTOTP:
    def test_generate_secret_is_base32(self):
        secret = generate_totp_secret()
        assert len(secret) == 32
        assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" for c in secret)

    def test_get_totp_uri_contains_issuer(self):
        uri = get_totp_uri("JBSWY3DPEHPK3PXP", "testuser")
        assert "testuser" in uri
        assert "Lighting+Control+Dashboard" in uri or "Lighting%20Control%20Dashboard" in uri

    def test_verify_valid_code(self):
        import pyotp
        secret = generate_totp_secret()
        totp = pyotp.TOTP(secret)
        code = totp.now()
        assert verify_totp_code(secret, code) is True

    def test_verify_invalid_code(self):
        secret = generate_totp_secret()
        assert verify_totp_code(secret, "000000") is False
