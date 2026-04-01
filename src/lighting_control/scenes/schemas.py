"""Scene Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, Field


# The 37 built-in WiZ scenes
BUILTIN_SCENES = [
    {"id": 1, "name": "Ocean", "color": "#0077BE"}, {"id": 2, "name": "Romance", "color": "#FF6B81"},
    {"id": 3, "name": "Sunset", "color": "#FF6347"}, {"id": 4, "name": "Party", "color": "#FF00FF"},
    {"id": 5, "name": "Fireplace", "color": "#FF4500"}, {"id": 6, "name": "Cozy", "color": "#FFB347"},
    {"id": 7, "name": "Forest", "color": "#228B22"}, {"id": 8, "name": "Pastel Colors", "color": "#FFB6C1"},
    {"id": 9, "name": "Wake Up", "color": "#FFFACD"}, {"id": 10, "name": "Bedtime", "color": "#483D8B"},
    {"id": 11, "name": "Warm White", "color": "#FFD700"}, {"id": 12, "name": "Daylight", "color": "#F0F8FF"},
    {"id": 13, "name": "Cool White", "color": "#E0FFFF"}, {"id": 14, "name": "Night Light", "color": "#FF8C00"},
    {"id": 15, "name": "Focus", "color": "#87CEEB"}, {"id": 16, "name": "Relax", "color": "#FFA07A"},
    {"id": 17, "name": "True Colors", "color": "#FFFFFF"}, {"id": 18, "name": "TV Time", "color": "#4169E1"},
    {"id": 19, "name": "Plant Growth", "color": "#FF69B4"}, {"id": 20, "name": "Spring", "color": "#98FB98"},
    {"id": 21, "name": "Summer", "color": "#FFD700"}, {"id": 22, "name": "Fall", "color": "#D2691E"},
    {"id": 23, "name": "Deep Dive", "color": "#00008B"}, {"id": 24, "name": "Jungle", "color": "#006400"},
    {"id": 25, "name": "Mojito", "color": "#7CFC00"}, {"id": 26, "name": "Club", "color": "#8A2BE2"},
    {"id": 27, "name": "Christmas", "color": "#FF0000"}, {"id": 28, "name": "Halloween", "color": "#FF6600"},
    {"id": 29, "name": "Candlelight", "color": "#FFD700"}, {"id": 30, "name": "Golden White", "color": "#FFFACD"},
    {"id": 31, "name": "Pulse", "color": "#FF1493"}, {"id": 32, "name": "Steampunk", "color": "#B8860B"},
    {"id": 33, "name": "Diwali", "color": "#FF8C00"}, {"id": 34, "name": "White", "color": "#FFFFFF"},
    {"id": 35, "name": "Alarm", "color": "#FF0000"}, {"id": 36, "name": "Rhythm", "color": "#9400D3"},
    {"id": 37, "name": "Opal", "color": "#A8C3BC"},
]


class CustomSceneRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    color_r: int | None = Field(None, ge=0, le=255)
    color_g: int | None = Field(None, ge=0, le=255)
    color_b: int | None = Field(None, ge=0, le=255)
    color_temp: int | None = Field(None, ge=2200, le=6500)
    brightness: int = Field(100, ge=0, le=100)


class CustomSceneResponse(BaseModel):
    id: str
    name: str
    color_r: int | None
    color_g: int | None
    color_b: int | None
    color_temp: int | None
    brightness: int
    created_by: str
    created_at: datetime
    is_builtin: bool = False
    class Config:
        from_attributes = True


class SceneListResponse(BaseModel):
    builtin: list[dict]
    custom: list[CustomSceneResponse]
