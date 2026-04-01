"""Schedule execution engine."""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.devices.discovery import control_device
from lighting_control.devices.service import get_device, resolve_device_ids
from lighting_control.schedules.models import Schedule

logger = logging.getLogger(__name__)


async def execute_schedule(db: AsyncSession, schedule: Schedule) -> dict:
    """Execute all targets of a schedule — resolve device IDs and send setPilot commands."""
    results = {}
    for target in schedule.targets:
        device_ids = await resolve_device_ids(db, target.target_type.value, target.target_id, target.exclude_device_ids)
        for did in device_ids:
            device = await get_device(db, did)
            if device:
                result = await control_device(device.ip, target.state)
                results[did] = result is not None
                if result is not None:
                    from lighting_control.devices.service import update_device_state
                    await update_device_state(db, did, result)
    logger.info(f"Schedule '{schedule.name}' executed: {len(results)} devices")
    return results
