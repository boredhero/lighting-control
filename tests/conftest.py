"""Shared test fixtures for the lighting control test suite."""
import uuid
from datetime import datetime, timedelta, timezone
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from lighting_control.db.base import Base
from lighting_control.auth.models import Role, User, SystemConfig, InviteCode
from lighting_control.auth.service import hash_password, create_access_token
from lighting_control.devices.models import Device, Room, Zone, Group, GroupDevice


@pytest_asyncio.fixture
async def test_db():
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def admin_role(test_db: AsyncSession) -> Role:
    """Pre-created admin role."""
    role = Role(id=str(uuid.uuid4()), name="Admin", is_system=True, is_admin=True, permissions={"can_control_devices": True, "can_execute_quick_actions": True, "can_manage_quick_actions": True, "can_view_schedules": True, "can_manage_schedules": True, "can_manage_devices": True, "can_manage_users": True})
    test_db.add(role)
    await test_db.flush()
    return role


@pytest_asyncio.fixture
async def user_role(test_db: AsyncSession) -> Role:
    """Pre-created user role."""
    role = Role(id=str(uuid.uuid4()), name="User", is_system=True, permissions={"can_control_devices": True, "can_execute_quick_actions": True, "can_manage_quick_actions": False, "can_view_schedules": True, "can_manage_schedules": False, "can_manage_devices": False, "can_manage_users": False})
    test_db.add(role)
    await test_db.flush()
    return role


@pytest_asyncio.fixture
async def admin_user(test_db: AsyncSession) -> User:
    """Pre-created admin user with known credentials."""
    user = User(id=str(uuid.uuid4()), username="admin", password_hash=hash_password("testpass123"), is_admin=True, is_guest=False, permissions={"can_control_devices": True, "can_execute_quick_actions": True, "can_manage_quick_actions": True, "can_view_schedules": True, "can_manage_schedules": True, "can_manage_devices": True, "can_manage_users": True})
    test_db.add(user)
    await test_db.flush()
    return user


@pytest_asyncio.fixture
async def guest_user(test_db: AsyncSession, admin_user: User) -> User:
    """Pre-created guest with limited permissions and 24h expiry."""
    user = User(id=str(uuid.uuid4()), username="guest", password_hash=hash_password("guestpass123"), is_admin=False, is_guest=True, guest_expires_at=datetime.now(timezone.utc) + timedelta(hours=24), permissions={"can_control_devices": True, "can_execute_quick_actions": True, "can_manage_quick_actions": False, "can_view_schedules": True, "can_manage_schedules": False, "can_manage_devices": False, "can_manage_users": False}, created_by=admin_user.id)
    test_db.add(user)
    await test_db.flush()
    return user


@pytest_asyncio.fixture
async def expired_guest(test_db: AsyncSession, admin_user: User) -> User:
    """Guest account that has already expired."""
    user = User(id=str(uuid.uuid4()), username="expired_guest", password_hash=hash_password("expiredpass"), is_admin=False, is_guest=True, guest_expires_at=datetime.now(timezone.utc) - timedelta(hours=1), permissions={"can_control_devices": True}, created_by=admin_user.id)
    test_db.add(user)
    await test_db.flush()
    return user


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """Valid JWT access token for the admin user."""
    return create_access_token(admin_user.id, admin_user.is_admin, admin_user.permissions)


@pytest.fixture
def guest_token(guest_user: User) -> str:
    """Valid JWT access token for the guest user."""
    return create_access_token(guest_user.id, guest_user.is_admin, guest_user.permissions)


@pytest_asyncio.fixture
async def two_rooms(test_db: AsyncSession) -> tuple[Room, Room]:
    """Two rooms: Living Room and Bedroom."""
    r1 = Room(id=str(uuid.uuid4()), name="Living Room", sort_order=0)
    r2 = Room(id=str(uuid.uuid4()), name="Bedroom", sort_order=1)
    test_db.add_all([r1, r2])
    await test_db.flush()
    return r1, r2


@pytest_asyncio.fixture
async def one_zone(test_db: AsyncSession) -> Zone:
    """A single zone: Upstairs."""
    z = Zone(id=str(uuid.uuid4()), name="Upstairs", sort_order=0)
    test_db.add(z)
    await test_db.flush()
    return z


@pytest_asyncio.fixture
async def one_group(test_db: AsyncSession) -> Group:
    """A single group: Movie Lights."""
    g = Group(id=str(uuid.uuid4()), name="Movie Lights", sort_order=0)
    test_db.add(g)
    await test_db.flush()
    return g


@pytest_asyncio.fixture
async def sample_devices(test_db: AsyncSession, two_rooms: tuple[Room, Room], one_zone: Zone, one_group: Group) -> list[Device]:
    """5 devices across 2 rooms, 1 zone, 1 group."""
    r1, r2 = two_rooms
    devices = []
    for i, (name, mac, room_id, zone_id, online) in enumerate([
        ("Living Lamp", "AA:BB:CC:DD:EE:01", r1.id, None, True),
        ("Living Strip", "AA:BB:CC:DD:EE:02", r1.id, None, True),
        ("Bed Light", "AA:BB:CC:DD:EE:03", r2.id, one_zone.id, True),
        ("Bed Lamp", "AA:BB:CC:DD:EE:04", r2.id, one_zone.id, False),
        ("Hall Bulb", "AA:BB:CC:DD:EE:05", None, None, True),
    ]):
        d = Device(id=str(uuid.uuid4()), mac=mac, ip=f"192.168.1.{10+i}", name=name, bulb_type="RGBW", room_id=room_id, zone_id=zone_id, is_online=online, last_seen=datetime.now(timezone.utc))
        test_db.add(d)
        devices.append(d)
    await test_db.flush()
    gd1 = GroupDevice(group_id=one_group.id, device_id=devices[0].id)
    gd2 = GroupDevice(group_id=one_group.id, device_id=devices[2].id)
    test_db.add_all([gd1, gd2])
    await test_db.flush()
    return devices
