"""WebAuthn/passkey ceremony helpers."""
import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import webauthn
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from webauthn.helpers.cose import COSEAlgorithmIdentifier
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    AuthenticatorTransport,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from lighting_control.auth.models import Passkey, User, WebAuthnChallenge
from lighting_control.config import settings

logger = logging.getLogger(__name__)

CHALLENGE_TTL_SECONDS = 120
PUB_KEY_ALGS = [COSEAlgorithmIdentifier.ECDSA_SHA_256, COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256]
SUPPORTED_TRANSPORTS = {t.value for t in AuthenticatorTransport}
REGRESSION_REVOKE_WINDOW = timedelta(hours=24)


class PasskeyError(Exception):
    """Raised for any passkey ceremony failure. Caller maps to HTTPException."""


def new_session_id() -> str:
    return secrets.token_hex(32)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _strip_tz(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _fake_credential_ids(username: str, count: int = 2) -> list[bytes]:
    seed = hashlib.sha256(("fake-creds:" + (settings.JWT_SECRET or "") + ":" + username).encode()).digest()
    return [hashlib.sha256(seed + i.to_bytes(4, "big")).digest()[:32] for i in range(count)]


def _transports_from_credential(credential_json: dict) -> list[str]:
    response = credential_json.get("response", {}) or {}
    raw = response.get("transports") or []
    return [t for t in raw if t in SUPPORTED_TRANSPORTS]


def _transports_to_descriptors(transports: list[str] | None) -> list[AuthenticatorTransport] | None:
    if not transports:
        return None
    out: list[AuthenticatorTransport] = []
    for t in transports:
        try:
            out.append(AuthenticatorTransport(t))
        except ValueError:
            continue
    return out or None


async def _delete_challenge(db: AsyncSession, session_id: str) -> WebAuthnChallenge | None:
    result = await db.execute(select(WebAuthnChallenge).where(WebAuthnChallenge.session_id == session_id))
    row = result.scalar_one_or_none()
    if row is None:
        return None
    await db.delete(row)
    await db.flush()
    return row


async def _persist_challenge(
    db: AsyncSession,
    *,
    session_id: str,
    challenge: bytes,
    kind: str,
    user_id: str | None = None,
    expected_user_handle: bytes | None = None,
    bridge_user_id: str | None = None,
) -> None:
    row = WebAuthnChallenge(
        session_id=session_id,
        challenge=challenge,
        kind=kind,
        user_id=user_id,
        expected_user_handle=expected_user_handle,
        bridge_user_id=bridge_user_id,
        expires_at=_now() + timedelta(seconds=CHALLENGE_TTL_SECONDS),
    )
    db.add(row)
    await db.flush()


async def _load_active_passkeys(db: AsyncSession, user_id: str) -> list[Passkey]:
    result = await db.execute(select(Passkey).where(Passkey.user_id == user_id, Passkey.revoked_at.is_(None)))
    return list(result.scalars().all())


async def register_start(db: AsyncSession, user: User, *, session_id: str) -> dict:
    """Build registration options and persist the challenge.

    resident_key=DISCOURAGED so we use server-side credentials.
    user_verification=DISCOURAGED so touch-only authenticators work without PIN.
    Platform authenticators (fingerprint/face) are still offered when available.
    """
    if user.webauthn_user_handle is None:
        user.webauthn_user_handle = os.urandom(64)
        await db.flush()
    existing = await _load_active_passkeys(db, user.id)
    exclude = [PublicKeyCredentialDescriptor(id=p.credential_id) for p in existing]
    selection = AuthenticatorSelectionCriteria(
        resident_key=ResidentKeyRequirement.DISCOURAGED,
        user_verification=UserVerificationRequirement.DISCOURAGED,
    )
    options = webauthn.generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_name=user.username,
        user_id=user.webauthn_user_handle,
        user_display_name=user.username,
        timeout=60000,
        authenticator_selection=selection,
        exclude_credentials=exclude,
    )
    await _persist_challenge(db, session_id=session_id, challenge=options.challenge, kind="register", user_id=user.id, expected_user_handle=user.webauthn_user_handle)
    return webauthn_options_to_json(options)


def webauthn_options_to_json(options) -> dict:
    """Serialize a py_webauthn options object to a browser-ready JSON dict."""
    from webauthn.helpers import options_to_json
    import json
    return json.loads(options_to_json(options))


def _derive_device_type(verified_device_type: str) -> str:
    val = str(verified_device_type).lower()
    if "multi" in val:
        return "multiDevice"
    return "singleDevice"


def _derive_non_uv_only(uv: bool, transports: list[str]) -> bool:
    if uv:
        return False
    if "internal" in transports:
        return False
    return True


async def register_finish(
    db: AsyncSession,
    user: User,
    *,
    session_id: str,
    credential_json: dict,
    suggested_name: str,
) -> Passkey:
    """Verify registration ceremony and INSERT a Passkey row."""
    challenge_row = await _delete_challenge(db, session_id)
    if challenge_row is None:
        raise PasskeyError("challenge_missing_or_expired")
    if challenge_row.kind != "register":
        raise PasskeyError("wrong_challenge_kind")
    if challenge_row.user_id != user.id:
        raise PasskeyError("challenge_user_mismatch")
    if challenge_row.expires_at < _now():
        raise PasskeyError("challenge_missing_or_expired")
    try:
        verified = webauthn.verify_registration_response(
            credential=credential_json,
            expected_challenge=challenge_row.challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            require_user_verification=False,
        )
    except Exception as e:
        logger.warning("passkey registration verify failed: %s", e)
        raise PasskeyError("verification_failed") from e
    existing = await db.execute(select(Passkey).where(Passkey.credential_id == verified.credential_id))
    if existing.scalar_one_or_none() is not None:
        raise PasskeyError("credential_already_registered")
    transports = _transports_from_credential(credential_json)
    aaguid_str = verified.aaguid if verified.aaguid else None
    device_type = _derive_device_type(str(verified.credential_device_type))
    non_uv_only = _derive_non_uv_only(verified.user_verified, transports)
    if verified.user_verified:
        result = await db.execute(
            select(Passkey).where(
                Passkey.user_id == user.id,
                Passkey.aaguid == aaguid_str,
                Passkey.non_uv_only == True,
                Passkey.revoked_at.is_(None),
            )
        )
        for old in result.scalars().all():
            old.revoked_at = _now()
            logger.info("upgrading passkey %s — revoking touch-only sibling for user %s", old.id, user.id)
    passkey = Passkey(
        user_id=user.id,
        credential_id=verified.credential_id,
        public_key=verified.credential_public_key,
        sign_count=verified.sign_count,
        name=suggested_name[:64] if suggested_name else "Passkey",
        transports=transports,
        aaguid=aaguid_str,
        attestation_fmt=str(verified.fmt) if verified.fmt else None,
        backup_eligible=bool(verified.credential_backed_up) or device_type == "multiDevice",
        backup_state=bool(verified.credential_backed_up),
        uv_initialized=bool(verified.user_verified),
        non_uv_only=non_uv_only,
        device_type=device_type,
    )
    db.add(passkey)
    await db.flush()
    return passkey


async def authenticate_start(
    db: AsyncSession,
    *,
    session_id: str,
    username: str | None = None,
    bridge_user_id: str | None = None,
) -> dict:
    """Build authentication options. Account-enumeration safe."""
    allow: list[PublicKeyCredentialDescriptor] = []
    target_user: User | None = None
    if username:
        result = await db.execute(select(User).options(selectinload(User.passkeys)).where(User.username == username))
        target_user = result.scalar_one_or_none()
        if target_user is not None:
            allow = [PublicKeyCredentialDescriptor(id=p.credential_id) for p in target_user.passkeys if p.revoked_at is None]
        if not allow:
            allow = [PublicKeyCredentialDescriptor(id=fid) for fid in _fake_credential_ids(username)]
    options = webauthn.generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        timeout=60000,
        allow_credentials=allow if allow else None,
        user_verification=UserVerificationRequirement.DISCOURAGED,
    )
    await _persist_challenge(db, session_id=session_id, challenge=options.challenge, kind="authenticate", user_id=target_user.id if target_user else None, bridge_user_id=bridge_user_id)
    return webauthn_options_to_json(options)


async def authenticate_finish(
    db: AsyncSession,
    *,
    session_id: str,
    credential_json: dict,
    bridge_user_id: str | None = None,
) -> tuple[User, Passkey]:
    """Verify authentication ceremony, return (user, passkey) on success."""
    challenge_row = await _delete_challenge(db, session_id)
    if challenge_row is None:
        raise PasskeyError("challenge_missing_or_expired")
    if challenge_row.kind != "authenticate":
        raise PasskeyError("wrong_challenge_kind")
    if challenge_row.expires_at < _now():
        raise PasskeyError("challenge_missing_or_expired")
    raw_id = credential_json.get("rawId") or credential_json.get("id")
    if isinstance(raw_id, str):
        from webauthn.helpers import base64url_to_bytes
        try:
            credential_id = base64url_to_bytes(raw_id)
        except Exception as e:
            raise PasskeyError("malformed_credential") from e
    elif isinstance(raw_id, (bytes, bytearray)):
        credential_id = bytes(raw_id)
    else:
        raise PasskeyError("malformed_credential")
    result = await db.execute(select(Passkey).options(selectinload(Passkey.user)).where(Passkey.credential_id == credential_id))
    passkey = result.scalar_one_or_none()
    if passkey is None or passkey.revoked_at is not None:
        raise PasskeyError("credential_not_found_or_revoked")
    try:
        verified = webauthn.verify_authentication_response(
            credential=credential_json,
            expected_challenge=challenge_row.challenge,
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            credential_public_key=passkey.public_key,
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=False,
        )
    except Exception as e:
        logger.warning("passkey authentication verify failed for credential %s: %s", passkey.id, e)
        raise PasskeyError("verification_failed") from e
    new_count = verified.new_sign_count
    if passkey.device_type == "singleDevice":
        is_regression = (new_count <= passkey.sign_count) and not (new_count == 0 and passkey.sign_count == 0)
        if is_regression:
            now = _now()
            last_reg = _strip_tz(passkey.last_regression_at)
            recent = last_reg is not None and (now - last_reg) < REGRESSION_REVOKE_WINDOW
            if recent:
                passkey.revoked_at = now
                await db.flush()
                logger.error("revoking passkey %s after second sign-count regression in 24h", passkey.id)
                raise PasskeyError("authenticator_integrity_failed_revoked")
            else:
                passkey.last_regression_at = now
                await db.flush()
                logger.warning("sign-count regression on passkey %s (stored=%d new=%d) — first warning", passkey.id, passkey.sign_count, new_count)
                raise PasskeyError("authenticator_integrity_warning")
    if passkey.non_uv_only:
        if bridge_user_id is None:
            raise PasskeyError("requires_password_first")
        if bridge_user_id != passkey.user_id:
            raise PasskeyError("user_mismatch")
    passkey.sign_count = new_count
    passkey.last_used_at = _now()
    await db.flush()
    return passkey.user, passkey


async def cleanup_expired_challenges(db: AsyncSession) -> int:
    """DELETE all rows whose expires_at is in the past. Return deleted count."""
    result = await db.execute(select(WebAuthnChallenge).where(WebAuthnChallenge.expires_at < _now()))
    rows = list(result.scalars().all())
    for row in rows:
        await db.delete(row)
    await db.flush()
    return len(rows)


async def list_user_passkeys(db: AsyncSession, user_id: str) -> list[Passkey]:
    result = await db.execute(select(Passkey).where(Passkey.user_id == user_id, Passkey.revoked_at.is_(None)).order_by(Passkey.created_at))
    return list(result.scalars().all())


async def get_user_active_passkey_count(db: AsyncSession, user_id: str) -> int:
    return len(await list_user_passkeys(db, user_id))


async def soft_revoke_passkey(db: AsyncSession, passkey_id: str, user_id: str) -> bool:
    result = await db.execute(select(Passkey).where(Passkey.id == passkey_id, Passkey.user_id == user_id, Passkey.revoked_at.is_(None)))
    passkey = result.scalar_one_or_none()
    if passkey is None:
        return False
    passkey.revoked_at = _now()
    await db.flush()
    return True


async def rename_passkey(db: AsyncSession, passkey_id: str, user_id: str, new_name: str) -> Passkey | None:
    result = await db.execute(select(Passkey).where(Passkey.id == passkey_id, Passkey.user_id == user_id, Passkey.revoked_at.is_(None)))
    passkey = result.scalar_one_or_none()
    if passkey is None:
        return None
    passkey.name = new_name[:64]
    await db.flush()
    return passkey
