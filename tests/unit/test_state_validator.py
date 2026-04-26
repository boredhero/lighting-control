"""Tests for the device control state validator."""
import pytest
from fastapi import HTTPException
from lighting_control.devices.state_validator import MIN_MAX_CHANNEL, validate_control_state


class TestTurnOff:
    def test_turn_off_true_returns_only_turn_off(self):
        out = validate_control_state({"turn_off": True, "r": 255, "g": 0, "b": 0, "dimming": 50})
        assert out == {"turn_off": True}
    def test_legacy_state_false_returns_only_turn_off(self):
        out = validate_control_state({"state": False, "dimming": 50})
        assert out == {"turn_off": True}
    def test_turn_off_false_does_not_short_circuit(self):
        out = validate_control_state({"turn_off": False, "dimming": 50})
        assert out == {"dimming": 50}


class TestRgb:
    def test_valid_rgb_passes_through(self):
        out = validate_control_state({"r": 100, "g": 50, "b": 25})
        assert out == {"r": 100, "g": 50, "b": 25}
    def test_rgb_with_dimming(self):
        out = validate_control_state({"r": 100, "g": 50, "b": 25, "dimming": 80})
        assert out == {"r": 100, "g": 50, "b": 25, "dimming": 80}
    def test_pure_black_rgb_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_control_state({"r": 0, "g": 0, "b": 0})
        assert exc.value.status_code == 422
        assert "(0,0,0)" in exc.value.detail
    def test_partial_rgb_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_control_state({"r": 100})
        assert exc.value.status_code == 422
        assert "all of r, g, b" in exc.value.detail
    def test_rgb_max_boundary_passes(self):
        out = validate_control_state({"r": 255, "g": 255, "b": 255})
        assert out == {"r": 255, "g": 255, "b": 255}
    def test_r_negative_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_control_state({"r": -1, "g": 10, "b": 10})
        assert exc.value.status_code == 422
    def test_r_256_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"r": 256, "g": 10, "b": 10})
    def test_string_r_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_control_state({"r": "100", "g": 10, "b": 10})
        assert exc.value.status_code == 422
    def test_bool_r_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"r": True, "g": 10, "b": 10})


class TestNearBlackClamp:
    def test_peak_below_min_scales_to_min(self):
        out = validate_control_state({"r": 5, "g": 5, "b": 5})
        assert out == {"r": MIN_MAX_CHANNEL, "g": MIN_MAX_CHANNEL, "b": MIN_MAX_CHANNEL}
    def test_peak_at_min_unchanged(self):
        out = validate_control_state({"r": MIN_MAX_CHANNEL, "g": 0, "b": 0})
        assert out == {"r": 24, "g": 0, "b": 0}
    def test_peak_below_min_preserves_hue_ratio(self):
        out = validate_control_state({"r": 12, "g": 6, "b": 3})
        assert out == {"r": 24, "g": 12, "b": 6}
    def test_single_low_channel_with_zeroes_clamps_only_that_channel(self):
        out = validate_control_state({"r": 3, "g": 0, "b": 0})
        assert out == {"r": MIN_MAX_CHANNEL, "g": 0, "b": 0}
    def test_peak_25_unchanged(self):
        out = validate_control_state({"r": 25, "g": 0, "b": 0})
        assert out == {"r": 25, "g": 0, "b": 0}


class TestTemp:
    def test_valid_temp_passes(self):
        out = validate_control_state({"temp": 4000})
        assert out == {"temp": 4000}
    def test_temp_lo_boundary_passes(self):
        out = validate_control_state({"temp": 1000})
        assert out == {"temp": 1000}
    def test_temp_hi_boundary_passes(self):
        out = validate_control_state({"temp": 10000})
        assert out == {"temp": 10000}
    def test_temp_below_lo_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"temp": 999})
    def test_temp_above_hi_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"temp": 10001})
    def test_temp_with_dimming(self):
        out = validate_control_state({"temp": 3000, "dimming": 75})
        assert out == {"temp": 3000, "dimming": 75}


class TestScene:
    def test_scene_1_passes(self):
        out = validate_control_state({"scene": 1})
        assert out == {"scene": 1}
    def test_scene_37_passes(self):
        out = validate_control_state({"scene": 37})
        assert out == {"scene": 37}
    def test_scene_id_alias(self):
        out = validate_control_state({"sceneId": 5})
        assert out == {"scene": 5}
    def test_scene_0_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"scene": 0})
    def test_scene_38_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"scene": 38})
    def test_scene_string_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"scene": "Ocean"})


class TestDimming:
    def test_dimming_only_passes(self):
        out = validate_control_state({"dimming": 50})
        assert out == {"dimming": 50}
    def test_dimming_0_passes(self):
        out = validate_control_state({"dimming": 0})
        assert out == {"dimming": 0}
    def test_dimming_100_passes(self):
        out = validate_control_state({"dimming": 100})
        assert out == {"dimming": 100}
    def test_dimming_negative_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"dimming": -1})
    def test_dimming_101_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"dimming": 101})
    def test_bool_dimming_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"dimming": True})


class TestCombosRejected:
    def test_rgb_and_temp_combined_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_control_state({"r": 255, "g": 0, "b": 0, "temp": 3000})
        assert "exactly one" in exc.value.detail
    def test_rgb_and_scene_combined_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"r": 255, "g": 0, "b": 0, "scene": 1})
    def test_temp_and_scene_combined_rejected(self):
        with pytest.raises(HTTPException):
            validate_control_state({"temp": 3000, "scene": 1})
    def test_empty_state_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_control_state({})
        assert exc.value.status_code == 422
