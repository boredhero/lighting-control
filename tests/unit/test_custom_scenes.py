"""Tests for custom scene service."""
import uuid
import pytest
from lighting_control.scenes.service import (
    create_custom_scene, delete_custom_scene, get_all_custom_scenes,
    get_custom_scene, update_custom_scene,
)
from lighting_control.scenes.schemas import BUILTIN_SCENES


class TestBuiltinScenes:
    def test_37_builtin_scenes_defined(self):
        assert len(BUILTIN_SCENES) == 37

    def test_each_scene_has_required_fields(self):
        for scene in BUILTIN_SCENES:
            assert "id" in scene
            assert "name" in scene
            assert "color" in scene

    def test_scene_ids_are_unique(self):
        ids = [s["id"] for s in BUILTIN_SCENES]
        assert len(ids) == len(set(ids))

    def test_scene_ids_are_1_to_37(self):
        ids = sorted([s["id"] for s in BUILTIN_SCENES])
        assert ids == list(range(1, 38))


class TestCustomSceneCRUD:
    async def test_create_rgb_scene(self, test_db, admin_user):
        scene = await create_custom_scene(test_db, "Movie Night", 30, 0, 50, None, 40, admin_user.id)
        assert scene.name == "Movie Night"
        assert scene.color_r == 30
        assert scene.color_g == 0
        assert scene.color_b == 50
        assert scene.color_temp is None
        assert scene.brightness == 40

    async def test_create_temp_scene(self, test_db, admin_user):
        scene = await create_custom_scene(test_db, "Reading", None, None, None, 4000, 80, admin_user.id)
        assert scene.color_temp == 4000
        assert scene.color_r is None

    async def test_list_custom_scenes(self, test_db, admin_user):
        await create_custom_scene(test_db, "B Scene", 255, 0, 0, None, 100, admin_user.id)
        await create_custom_scene(test_db, "A Scene", 0, 255, 0, None, 50, admin_user.id)
        scenes = await get_all_custom_scenes(test_db)
        assert len(scenes) == 2
        assert scenes[0].name == "A Scene", "Should be sorted by name"
        assert scenes[1].name == "B Scene"

    async def test_update_custom_scene(self, test_db, admin_user):
        scene = await create_custom_scene(test_db, "Old Name", 100, 100, 100, None, 50, admin_user.id)
        updated = await update_custom_scene(test_db, scene.id, "New Name", 200, 200, 200, None, 75)
        assert updated.name == "New Name"
        assert updated.color_r == 200
        assert updated.brightness == 75

    async def test_delete_custom_scene(self, test_db, admin_user):
        scene = await create_custom_scene(test_db, "Delete Me", 0, 0, 0, None, 0, admin_user.id)
        assert await delete_custom_scene(test_db, scene.id) is True
        assert await get_custom_scene(test_db, scene.id) is None

    async def test_delete_nonexistent_returns_false(self, test_db):
        assert await delete_custom_scene(test_db, str(uuid.uuid4())) is False
