"""Celery task for periodic device discovery."""
import asyncio
from lighting_control.tasks.celery_app import celery


@celery.task(name="lighting_control.tasks.discovery.discover_task")
def discover_task():
    from lighting_control.devices.discovery import run_discovery_and_persist
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(run_discovery_and_persist())
    finally:
        loop.close()
