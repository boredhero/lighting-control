"""Validate + normalize device control state payloads.

Strict mutual-exclusion: a state may carry exactly one of rgb, temp, or scene (each
optionally combined with dimming) — or turn_off on its own. Near-black rgb is clamped
to peak >= MIN_MAX_CHANNEL so the bulb actually responds.
"""
from fastapi import HTTPException
from lighting_control.scenes.schemas import BUILTIN_SCENES

MIN_MAX_CHANNEL = 24
_VALID_SCENE_IDS = {s["id"] for s in BUILTIN_SCENES}


def _err(detail: str) -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


def _check_int_range(state: dict, key: str, lo: int, hi: int) -> int:
    v = state[key]
    if isinstance(v, bool) or not isinstance(v, int):
        raise _err(f"{key} must be an integer")
    if not lo <= v <= hi:
        raise _err(f"{key} must be between {lo} and {hi}")
    return v


def validate_control_state(state: dict) -> dict:
    if state.get("turn_off") is True or state.get("state") is False:
        return {"turn_off": True}
    rgb_keys = [k for k in ("r", "g", "b") if k in state]
    has_full_rgb = len(rgb_keys) == 3
    has_partial_rgb = 0 < len(rgb_keys) < 3
    has_temp = "temp" in state
    has_scene = "scene" in state or "sceneId" in state
    has_dimming = "dimming" in state
    if has_partial_rgb:
        raise _err("rgb requires all of r, g, b together")
    modes = sum([has_full_rgb, has_temp, has_scene])
    if modes > 1:
        raise _err("state must use exactly one of rgb, temp, or scene (not combined)")
    if modes == 0 and not has_dimming:
        raise _err("state must include rgb, temp, scene, dimming, or turn_off")
    out: dict = {}
    if has_full_rgb:
        r = _check_int_range(state, "r", 0, 255)
        g = _check_int_range(state, "g", 0, 255)
        b = _check_int_range(state, "b", 0, 255)
        if r == 0 and g == 0 and b == 0:
            raise _err("rgb (0,0,0) is invalid; use turn_off:true or pick a brighter color")
        peak = max(r, g, b)
        if peak < MIN_MAX_CHANNEL:
            scale = MIN_MAX_CHANNEL / peak
            r = round(r * scale)
            g = round(g * scale)
            b = round(b * scale)
        out["r"], out["g"], out["b"] = r, g, b
    if has_temp:
        out["temp"] = _check_int_range(state, "temp", 1000, 10000)
    if has_scene:
        sid = state.get("scene", state.get("sceneId"))
        if isinstance(sid, bool) or not isinstance(sid, int):
            raise _err("scene id must be an integer")
        if sid not in _VALID_SCENE_IDS:
            raise _err(f"scene id {sid} is not a valid builtin scene")
        out["scene"] = sid
    if has_dimming:
        out["dimming"] = _check_int_range(state, "dimming", 0, 100)
    return out
