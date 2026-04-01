"""TOTP (Time-based One-Time Password) setup and verification."""
import pyotp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.auth.models import TOTPSecret, User
from lighting_control.config import settings


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=username, issuer_name=settings.WEBAUTHN_RP_NAME)


def verify_totp_code(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


async def enable_totp(db: AsyncSession, user: User, secret: str) -> None:
    totp_secret = TOTPSecret(user_id=user.id, encrypted_secret=secret)
    db.add(totp_secret)
    user.totp_enabled = True
    await db.flush()


async def disable_totp(db: AsyncSession, user: User) -> None:
    result = await db.execute(select(TOTPSecret).where(TOTPSecret.user_id == user.id))
    totp_secret = result.scalar_one_or_none()
    if totp_secret:
        await db.delete(totp_secret)
    user.totp_enabled = False
    await db.flush()


async def get_totp_secret(db: AsyncSession, user_id: str) -> str | None:
    result = await db.execute(select(TOTPSecret).where(TOTPSecret.user_id == user_id))
    totp_secret = result.scalar_one_or_none()
    return totp_secret.encrypted_secret if totp_secret else None
