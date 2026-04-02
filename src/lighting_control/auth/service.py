"""Auth business logic."""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from lighting_control.auth.models import APIKey, InviteCode, Role, Session, SystemConfig, TOTPSecret, User
from lighting_control.config import settings

ph = PasswordHasher()
ALGORITHM = "HS256"
DEFAULT_PERMISSIONS = {"can_control_devices": True, "can_execute_quick_actions": True, "can_manage_quick_actions": True, "can_view_schedules": True, "can_manage_schedules": True, "can_manage_devices": True, "can_manage_users": True}


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: str, is_admin: bool, permissions: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire, "type": "access", "is_admin": is_admin, "permissions": permissions}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire, "type": "refresh", "jti": str(uuid.uuid4())}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def create_partial_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {"sub": user_id, "exp": expire, "type": "partial"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])


async def is_setup_complete(db: AsyncSession) -> bool:
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "setup_complete"))
    config = result.scalar_one_or_none()
    return config is not None and config.value == "true"


async def mark_setup_complete(db: AsyncSession) -> None:
    config = SystemConfig(key="setup_complete", value="true")
    db.add(config)
    await db.flush()


# --- Roles ---


async def get_all_roles(db: AsyncSession) -> list[Role]:
    result = await db.execute(select(Role).order_by(Role.sort_order, Role.created_at))
    return list(result.scalars().all())


async def get_role(db: AsyncSession, role_id: str) -> Role | None:
    result = await db.execute(select(Role).where(Role.id == role_id))
    return result.scalar_one_or_none()


async def get_admin_role(db: AsyncSession) -> Role | None:
    result = await db.execute(select(Role).where(Role.is_system == True, Role.is_admin == True))
    return result.scalar_one_or_none()


async def create_role(db: AsyncSession, name: str, is_admin: bool = False, is_guest: bool = False, permissions: dict | None = None) -> Role:
    role = Role(name=name, is_admin=is_admin, is_guest=is_guest, permissions=permissions or DEFAULT_PERMISSIONS)
    db.add(role)
    await db.flush()
    return role


async def update_role(db: AsyncSession, role_id: str, name: str, is_admin: bool, is_guest: bool, permissions: dict) -> Role | None:
    role = await get_role(db, role_id)
    if not role:
        return None
    role.name = name
    role.is_admin = is_admin
    role.is_guest = is_guest
    role.permissions = permissions
    await db.flush()
    result = await db.execute(select(User).where(User.role_id == role_id))
    for user in result.scalars().all():
        user.is_admin = role.is_admin
        user.is_guest = role.is_guest
        user.permissions = role.permissions
    await db.flush()
    return role


async def delete_role(db: AsyncSession, role_id: str) -> bool:
    role = await get_role(db, role_id)
    if not role or role.is_system:
        return False
    result = await db.execute(select(User).where(User.role_id == role_id))
    if result.scalars().first():
        return False
    await db.delete(role)
    await db.flush()
    return True


# --- Users ---


def _sync_user_from_role(user: User, role: Role) -> None:
    user.role_id = role.id
    user.is_admin = role.is_admin
    user.is_guest = role.is_guest
    user.permissions = role.permissions


async def create_user(db: AsyncSession, username: str, password: str, role_id: str | None = None, is_admin: bool = False, is_guest: bool = False, guest_expires_at: datetime | None = None, permissions: dict | None = None, created_by: str | None = None) -> User:
    user = User(username=username, password_hash=hash_password(password), is_admin=is_admin, is_guest=is_guest, guest_expires_at=guest_expires_at, permissions=permissions or DEFAULT_PERMISSIONS, created_by=created_by)
    if role_id:
        role = await get_role(db, role_id)
        if role:
            _sync_user_from_role(user, role)
    db.add(user)
    await db.flush()
    return user


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).options(selectinload(User.passkeys)).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_session(db: AsyncSession, user_id: str, access_token: str, refresh_token: str) -> None:
    for token in [access_token, refresh_token]:
        session = Session(user_id=user_id, token_hash=hash_token(token), expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS))
        db.add(session)
    await db.flush()


async def is_token_revoked(db: AsyncSession, token: str) -> bool:
    token_h = hash_token(token)
    result = await db.execute(select(Session).where(Session.token_hash == token_h).order_by(Session.created_at.desc()).limit(1))
    session = result.scalar_one_or_none()
    if session is None:
        return True
    return session.revoked


async def revoke_user_sessions(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(select(Session).where(Session.user_id == user_id, Session.revoked == False))
    for session in result.scalars().all():
        session.revoked = True
    await db.flush()


async def update_user(db: AsyncSession, user_id: str, role_id: str, guest_expires_at: datetime | None = None) -> User | None:
    user = await get_user_by_id(db, user_id)
    if not user:
        return None
    role = await get_role(db, role_id)
    if not role:
        return None
    _sync_user_from_role(user, role)
    user.guest_expires_at = guest_expires_at if role.is_guest else None
    await db.flush()
    return user


async def delete_user(db: AsyncSession, user_id: str) -> bool:
    user = await get_user_by_id(db, user_id)
    if not user:
        return False
    await db.delete(user)
    await db.flush()
    return True


async def get_all_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at))
    return list(result.scalars().all())


# --- Invites ---


async def create_invite(db: AsyncSession, created_by: str, role_id: str, expires_at: datetime | None = None) -> InviteCode:
    code = secrets.token_urlsafe(32)
    invite = InviteCode(code=code, created_by=created_by, expires_at=expires_at, role_id=role_id)
    db.add(invite)
    await db.flush()
    return invite


async def get_invite(db: AsyncSession, code: str) -> InviteCode | None:
    result = await db.execute(select(InviteCode).where(InviteCode.code == code, InviteCode.used == False))
    invite = result.scalar_one_or_none()
    if invite and invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        return None
    return invite


async def get_active_invites(db: AsyncSession) -> list[InviteCode]:
    result = await db.execute(select(InviteCode).where(InviteCode.used == False).order_by(InviteCode.created_at.desc()))
    return list(result.scalars().all())


async def revoke_invite(db: AsyncSession, invite_id: str) -> bool:
    result = await db.execute(select(InviteCode).where(InviteCode.id == invite_id, InviteCode.used == False))
    invite = result.scalar_one_or_none()
    if not invite:
        return False
    await db.delete(invite)
    await db.flush()
    return True


async def use_invite(db: AsyncSession, invite: InviteCode, used_by: str) -> None:
    invite.used = True
    invite.used_by = used_by
    await db.flush()


# --- API Keys ---


async def create_api_key(db: AsyncSession, user_id: str, name: str, permissions: dict) -> tuple[APIKey, str]:
    raw_key = secrets.token_urlsafe(48)
    api_key = APIKey(user_id=user_id, key_hash=hash_token(raw_key), name=name, permissions=permissions)
    db.add(api_key)
    await db.flush()
    return api_key, raw_key


async def get_api_key_by_hash(db: AsyncSession, key_hash: str) -> APIKey | None:
    result = await db.execute(select(APIKey).where(APIKey.key_hash == key_hash))
    return result.scalar_one_or_none()


# --- Passkeys ---


async def get_user_passkeys(db: AsyncSession, user_id: str) -> list:
    from lighting_control.auth.models import Passkey
    result = await db.execute(select(Passkey).where(Passkey.user_id == user_id))
    return list(result.scalars().all())


async def delete_passkey(db: AsyncSession, passkey_id: str, user_id: str) -> bool:
    from lighting_control.auth.models import Passkey
    result = await db.execute(select(Passkey).where(Passkey.id == passkey_id, Passkey.user_id == user_id))
    passkey = result.scalar_one_or_none()
    if not passkey:
        return False
    await db.delete(passkey)
    await db.flush()
    return True
