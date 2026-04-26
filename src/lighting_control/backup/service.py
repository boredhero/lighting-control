"""Backup orchestrator — composes per-domain export/import helpers into a single envelope."""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.backup.schemas import BACKUP_VERSION
from lighting_control.devices import service as devices_service
from lighting_control.schedules import service as schedules_service
from lighting_control.quick_actions import service as qa_service
from lighting_control.scenes import service as scenes_service


async def export_all(db: AsyncSession, app_version: str | None = None) -> dict:
    """Compose the unified backup envelope from all domains."""
    return {
        "version": BACKUP_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "app_version": app_version,
        "data": {
            "devices": await devices_service.export_devices_for_backup(db),
            "hierarchy": await devices_service.export_hierarchy_for_backup(db),
            "schedules": await schedules_service.export_schedules(db),
            "quick_actions": await qa_service.export_quick_actions(db),
            "scenes": await scenes_service.export_scenes(db),
        },
    }


async def import_all(db: AsyncSession, version: int, data: dict, mode: str, created_by: str) -> dict:
    """Restore from a unified backup envelope. Atomic: any failure rolls back the entire restore.

    Order is significant for FK target remapping (C1 invariant):
      1. Devices: matched by MAC, never wiped (devices are physical). Returns id_remap (backup_device.id -> current_device.id).
      2. Hierarchy: rooms/zones/groups matched by name. Returns id_remap (backup_uuid -> current_uuid). In replace mode, wipes existing first.
      3. Schedules / QuickActions / Scenes: target_id and exclude_device_ids fields are remapped using the merged id_remap from steps 1 and 2.
    """
    if version != BACKUP_VERSION:
        raise ValueError(f"Unsupported backup version: {version} (expected {BACKUP_VERSION})")
    id_remap: dict[str, str] = {}
    device_remap = await devices_service.import_devices_for_backup(db, data.get("devices", []))
    id_remap.update(device_remap)
    hierarchy_remap = await devices_service.import_hierarchy_for_backup(db, data.get("hierarchy", {}), mode)
    id_remap.update(hierarchy_remap)
    schedules_result = await schedules_service.import_schedules(db, data.get("schedules", []), mode, created_by, id_remap)
    qa_result = await qa_service.import_quick_actions(db, data.get("quick_actions", []), mode, created_by, id_remap)
    scenes_result = await scenes_service.import_scenes(db, data.get("scenes", []), mode, created_by)
    rooms_count = sum(1 for k in hierarchy_remap)
    return {
        "devices_updated": len(device_remap),
        "rooms": {"remapped": rooms_count},
        "schedules": schedules_result,
        "quick_actions": qa_result,
        "scenes": scenes_result,
    }
