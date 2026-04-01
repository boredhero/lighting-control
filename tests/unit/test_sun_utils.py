"""Tests for sunrise/sunset calculation utility."""
from datetime import date, datetime, timedelta, timezone
import pytest
from lighting_control.utils.sun import apply_offset, get_sunrise_sunset


class TestSunriseSunset:
    def test_known_location_returns_reasonable_times(self):
        """New York City on June 21 — sunrise ~5:25 UTC, sunset ~00:31 UTC (next day)."""
        sunrise, sunset = get_sunrise_sunset(40.7128, -74.0060, "America/New_York", date(2025, 6, 21))
        assert sunrise.hour >= 9 and sunrise.hour <= 10, f"NYC June 21 sunrise should be ~9:25 UTC, got {sunrise}"
        assert sunset.hour >= 0 and sunset.hour <= 2, f"NYC June 21 sunset should be ~0:31 UTC, got {sunset}"

    def test_different_date_different_times(self):
        """Sunrise time should differ between summer and winter solstice."""
        summer_sr, _ = get_sunrise_sunset(40.7128, -74.0060, "America/New_York", date(2025, 6, 21))
        winter_sr, _ = get_sunrise_sunset(40.7128, -74.0060, "America/New_York", date(2025, 12, 21))
        assert summer_sr != winter_sr

    def test_returns_utc_datetimes(self):
        sunrise, sunset = get_sunrise_sunset(40.7128, -74.0060, "UTC", date(2025, 3, 20))
        assert sunrise.tzinfo is not None
        assert sunset.tzinfo is not None


class TestOffset:
    def test_positive_offset(self):
        dt = datetime(2025, 6, 21, 10, 0, 0, tzinfo=timezone.utc)
        result = apply_offset(dt, 30)
        assert result == datetime(2025, 6, 21, 10, 30, 0, tzinfo=timezone.utc)

    def test_negative_offset(self):
        dt = datetime(2025, 6, 21, 10, 0, 0, tzinfo=timezone.utc)
        result = apply_offset(dt, -15)
        assert result == datetime(2025, 6, 21, 9, 45, 0, tzinfo=timezone.utc)

    def test_zero_offset(self):
        dt = datetime(2025, 6, 21, 10, 0, 0, tzinfo=timezone.utc)
        result = apply_offset(dt, 0)
        assert result == dt
