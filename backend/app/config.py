# backend/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    DATABASE_PATH: str = "backend/data/civic_issue.db"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    GROQ_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
