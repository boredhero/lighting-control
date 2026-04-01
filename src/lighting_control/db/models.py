"""Re-export all ORM models so Alembic can discover them."""
from lighting_control.db.base import Base
from lighting_control.auth.models import User, TOTPSecret, Passkey, Session, APIKey, SystemConfig, InviteCode  # noqa: F401
from lighting_control.devices.models import Device, Room, Zone, Group, GroupDevice  # noqa: F401
from lighting_control.quick_actions.models import QuickAction, QuickActionTarget  # noqa: F401
from lighting_control.schedules.models import Schedule, ScheduleTrigger, ScheduleTarget  # noqa: F401
from lighting_control.scenes.models import CustomScene  # noqa: F401
from lighting_control.notifications.models import PushSubscription  # noqa: F401

__all__ = ["Base"]
