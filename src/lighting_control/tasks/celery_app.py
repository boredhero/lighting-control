"""Celery application configuration."""
from celery import Celery
from lighting_control.config import settings

celery = Celery("lighting_control", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "discover-devices": {"task": "lighting_control.tasks.discovery.discover_task", "schedule": settings.DISCOVERY_INTERVAL_SECONDS},
        "check-cron-schedules": {"task": "lighting_control.tasks.scheduling.check_cron_schedules", "schedule": 30.0},
        "recalc-sun-times": {"task": "lighting_control.tasks.scheduling.recalc_sun_times", "schedule": 3600.0},
    },
)
celery.autodiscover_tasks(["lighting_control.tasks"])
