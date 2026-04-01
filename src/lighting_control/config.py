"""Application configuration via environment variables."""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///app/data/lighting.db"
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    # Data storage
    DATA_DIR: Path = Path("/app/data")
    # JWT
    JWT_SECRET: str = "changeme"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    # WebAuthn
    WEBAUTHN_RP_ID: str = "lights.martinospizza.dev"
    WEBAUTHN_RP_NAME: str = "Lighting Control Dashboard"
    WEBAUTHN_ORIGIN: str = "https://lights.martinospizza.dev"
    # VAPID (Web Push)
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_CONTACT_EMAIL: str = "mailto:you@example.com"
    # Discovery
    DISCOVERY_INTERVAL_SECONDS: int = 60
    # Server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8420

    @property
    def data_dir_path(self) -> Path:
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        return self.DATA_DIR


settings = Settings()
