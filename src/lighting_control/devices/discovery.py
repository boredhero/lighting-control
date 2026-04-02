"""WiZ device discovery via pywizlight UDP broadcast."""
import asyncio
import logging
from pywizlight import discovery, wizlight, PilotBuilder
from sqlalchemy.ext.asyncio import AsyncSession
from lighting_control.config import settings
from lighting_control.db.engine import async_session
from lighting_control.devices.service import upsert_device

logger = logging.getLogger(__name__)
BROADCAST_SPACE = "192.168.1.255"


async def discover_devices() -> list[dict]:
    """Discover WiZ devices on the LAN via UDP broadcast.
    Returns list of discovered device info dicts.
    """
    discovered = []
    try:
        bulbs = await discovery.discover_lights(broadcast_space=BROADCAST_SPACE)
        logger.info(f"UDP broadcast found {len(bulbs)} bulb(s)")
        for bulb in bulbs:
            try:
                await bulb.updateState()
                sys_config = None
                try:
                    sys_config = await bulb.getSystemConfig()
                except Exception:
                    pass
                info = {"mac": bulb.mac, "ip": bulb.ip, "model": getattr(sys_config, 'moduleName', None) if sys_config else None, "module_name": getattr(bulb, 'modelconfig', None) and getattr(bulb.modelconfig, 'module_name', None), "bulb_type": str(bulb.bulbtype) if hasattr(bulb, 'bulbtype') else None, "firmware_version": getattr(sys_config, 'fwVersion', None) if sys_config else None, "state": bulb.state.pilotResult if bulb.state else None}
                discovered.append(info)
            except Exception as e:
                logger.warning(f"Failed to query bulb at {bulb.ip}: {e}")
    except Exception as e:
        logger.error(f"Discovery failed: {e}")
    return discovered


async def run_discovery_and_persist() -> int:
    """Run discovery and upsert results into the database. Returns count of devices found."""
    devices = await discover_devices()
    async with async_session() as db:
        for info in devices:
            device = await upsert_device(db, mac=info["mac"], ip=info["ip"], model=info.get("model"), module_name=info.get("module_name"), bulb_type=info.get("bulb_type"), firmware_version=info.get("firmware_version"))
            if info.get("state"):
                from lighting_control.devices.service import update_device_state
                await update_device_state(db, device.id, info["state"])
        await db.commit()
    logger.info(f"Discovery complete: {len(devices)} devices found and persisted")
    return len(devices)


def _translate_state_to_pilot_args(state: dict) -> dict:
    """Translate frontend/WiZ protocol keys to PilotBuilder parameter names."""
    translated = {}
    if "dimming" in state:
        translated["brightness"] = int(state["dimming"] * 255 / 100)
    if "brightness" in state:
        val = state["brightness"]
        translated["brightness"] = int(val * 255 / 100) if val <= 100 else val
    if "temp" in state:
        translated["colortemp"] = state["temp"]
    if "colortemp" in state:
        translated["colortemp"] = state["colortemp"]
    if "sceneId" in state or "scene" in state:
        translated["scene"] = state.get("sceneId") or state.get("scene")
    if "r" in state and "g" in state and "b" in state:
        translated["rgb"] = (state["r"], state["g"], state["b"])
    if "w" in state:
        translated["warm_white"] = state["w"]
    if "c" in state:
        translated["cold_white"] = state["c"]
    if "speed" in state:
        translated["speed"] = state["speed"]
    if "state" in state:
        translated["state"] = state["state"]
    return translated


async def control_device(ip: str, state: dict) -> dict | None:
    """Send a setPilot command to a device. Returns the pilot result or None on failure."""
    try:
        bulb = wizlight(ip)
        turn_off = state.pop("turn_off", False)
        if turn_off:
            await bulb.turn_off()
            await bulb.updateState()
            return bulb.state.pilotResult if bulb.state else {"state": False}
        pilot_args = _translate_state_to_pilot_args(state)
        logger.info(f"Sending setPilot to {ip}: {state} -> PilotBuilder({pilot_args})")
        pilot = PilotBuilder(**pilot_args)
        await bulb.turn_on(pilot)
        await bulb.updateState()
        result = bulb.state.pilotResult if bulb.state else None
        logger.info(f"Device {ip} responded: {result}")
        return result
    except Exception as e:
        logger.error(f"Failed to control device at {ip}: {e}", exc_info=True)
        return None
