"""Sunrise/sunset calculation using the astral library."""
from datetime import date, datetime, timedelta, timezone
from astral import LocationInfo
from astral.sun import sun


def get_sunrise_sunset(latitude: float, longitude: float, tz_name: str, target_date: date | None = None) -> tuple[datetime, datetime]:
    """Calculate sunrise and sunset for a given location and date.
    Returns (sunrise, sunset) as timezone-aware datetimes in UTC.
    """
    if target_date is None:
        target_date = date.today()
    location = LocationInfo(name="Home", region="", timezone=tz_name, latitude=latitude, longitude=longitude)
    s = sun(location.observer, date=target_date, tzinfo=timezone.utc)
    return s["sunrise"], s["sunset"]


def apply_offset(dt: datetime, offset_minutes: int) -> datetime:
    """Apply a minute offset to a datetime. Negative = before, positive = after."""
    return dt + timedelta(minutes=offset_minutes)
