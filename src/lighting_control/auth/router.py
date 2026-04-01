"""Auth API endpoints."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.auth import schemas, service, totp
from lighting_control.auth.dependencies import get_current_user, require_admin
from lighting_control.auth.models import User
from lighting_control.config import settings
from lighting_control.db.engine import get_session

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/setup-status", response_model=schemas.SetupStatusResponse)
async def setup_status(db: AsyncSession = Depends(get_session)):
    return schemas.SetupStatusResponse(setup_complete=await service.is_setup_complete(db))


@router.post("/setup", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def setup(req: schemas.SetupRequest, db: AsyncSession = Depends(get_session)):
    if await service.is_setup_complete(db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Setup already complete")
    user = await service.create_user(db, req.username, req.password, is_admin=True)
    await service.mark_setup_complete(db)
    await db.commit()
    return user


@router.post("/login", response_model=schemas.TokenResponse)
async def login(req: schemas.LoginRequest, db: AsyncSession = Depends(get_session)):
    user = await service.get_user_by_username(db, req.username)
    if user is None or not service.verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.is_guest and user.guest_expires_at:
        if user.guest_expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Guest account expired")
    if user.totp_enabled:
        partial = service.create_partial_token(user.id)
        return schemas.TokenResponse(access_token="", refresh_token="", requires_totp=True, partial_token=partial)
    has_passkeys = len(user.passkeys) > 0 if user.passkeys else False
    if has_passkeys:
        partial = service.create_partial_token(user.id)
        return schemas.TokenResponse(access_token="", refresh_token="", requires_passkey=True, partial_token=partial)
    access = service.create_access_token(user.id, user.is_admin, user.permissions)
    refresh = service.create_refresh_token(user.id)
    await service.create_session(db, user.id, access, refresh)
    await db.commit()
    return schemas.TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login/totp", response_model=schemas.TokenResponse)
async def login_totp(req: schemas.TOTPVerifyRequest, db: AsyncSession = Depends(get_session)):
    try:
        payload = service.decode_token(req.partial_token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid partial token")
    if payload.get("type") != "partial":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    user = await service.get_user_by_id(db, payload["sub"])
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    secret = await totp.get_totp_secret(db, user.id)
    if secret is None or not totp.verify_totp_code(secret, req.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid TOTP code")
    access = service.create_access_token(user.id, user.is_admin, user.permissions)
    refresh = service.create_refresh_token(user.id)
    await service.create_session(db, user.id, access, refresh)
    await db.commit()
    return schemas.TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=schemas.TokenResponse)
async def refresh(req: schemas.RefreshRequest, db: AsyncSession = Depends(get_session)):
    try:
        payload = service.decode_token(req.refresh_token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    if await service.is_token_revoked(db, req.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")
    user = await service.get_user_by_id(db, payload["sub"])
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    access = service.create_access_token(user.id, user.is_admin, user.permissions)
    refresh_token = service.create_refresh_token(user.id)
    await service.create_session(db, user.id, access, refresh_token)
    await db.commit()
    return schemas.TokenResponse(access_token=access, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    await service.revoke_user_sessions(db, user.id)
    await db.commit()


@router.post("/guests", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def create_guest(req: schemas.GuestCreateRequest, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)):
    existing = await service.get_user_by_username(db, req.username)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username taken")
    guest = await service.create_user(db, req.username, req.password, is_guest=True, guest_expires_at=req.expires_at, permissions=req.permissions, created_by=admin.id)
    await db.commit()
    return guest


@router.post("/invites", response_model=schemas.InviteCreateResponse)
async def create_invite(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)):
    invite = await service.create_invite(db, admin.id)
    await db.commit()
    url = f"{settings.WEBAUTHN_ORIGIN}/register?code={invite.code}"
    return schemas.InviteCreateResponse(code=invite.code, url=url)


@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def register(req: schemas.RegisterRequest, db: AsyncSession = Depends(get_session)):
    invite = await service.get_invite(db, req.invite_code)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or used invite code")
    existing = await service.get_user_by_username(db, req.username)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username taken")
    user = await service.create_user(db, req.username, req.password, is_admin=True)
    await service.use_invite(db, invite, user.id)
    await db.commit()
    return user


@router.get("/me", response_model=schemas.UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(req: schemas.ChangePasswordRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    if not service.verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password incorrect")
    user.password_hash = service.hash_password(req.new_password)
    await service.revoke_user_sessions(db, user.id)
    await db.commit()


@router.post("/me/totp/setup", response_model=schemas.TOTPSetupResponse)
async def setup_totp(user: User = Depends(get_current_user)):
    if user.totp_enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="TOTP already enabled")
    secret = totp.generate_totp_secret()
    uri = totp.get_totp_uri(secret, user.username)
    return schemas.TOTPSetupResponse(secret=secret, qr_uri=uri)


@router.post("/me/totp/enable", status_code=status.HTTP_204_NO_CONTENT)
async def enable_totp(req: schemas.TOTPVerifyRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    if not totp.verify_totp_code(req.partial_token, req.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid TOTP code")
    await totp.enable_totp(db, user, req.partial_token)
    await db.commit()


@router.delete("/me/totp", status_code=status.HTTP_204_NO_CONTENT)
async def disable_totp(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    await totp.disable_totp(db, user)
    await db.commit()


@router.post("/me/api-keys", response_model=schemas.APIKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(req: schemas.APIKeyCreateRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    api_key, raw_key = await service.create_api_key(db, user.id, req.name, req.permissions)
    await db.commit()
    return schemas.APIKeyCreateResponse(id=api_key.id, name=api_key.name, raw_key=raw_key, created_at=api_key.created_at)


@router.get("/users", response_model=list[schemas.UserResponse])
async def list_users(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)):
    users = await service.get_all_users(db)
    return users


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_session)):
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")
    if not await service.delete_user(db, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await db.commit()


@router.get("/me/passkeys", response_model=list[schemas.PasskeyResponse])
async def list_passkeys(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    passkeys = await service.get_user_passkeys(db, user.id)
    return passkeys


@router.delete("/me/passkeys/{passkey_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_passkey(passkey_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    if not await service.delete_passkey(db, passkey_id, user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey not found")
    await db.commit()
