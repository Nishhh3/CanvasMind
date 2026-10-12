import json

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hackathon API"
    # sqlite:///./app.db locally; on Render use the Supabase pooler URL.
    # postgres:// and postgresql:// are rewritten to postgresql+psycopg:// automatically.
    database_url: str = "sqlite:///./app.db"
    # Env var CORS_ORIGINS: comma separated ("https://a.vercel.app,http://localhost:3000") or a JSON list.
    cors_origins_raw: str = Field("http://localhost:3000", validation_alias="CORS_ORIGINS")
    # Optional regex to also allow Vercel preview deployments, e.g. https://.*\.vercel\.app
    cors_origin_regex: str = ""
    openrouter_api_key: str = ""
    llm_model: str = "openrouter/auto"
    vision_model: str = ""  # empty -> falls back to llm_model

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("database_url")
    @classmethod
    def _normalise_db_url(cls, v: str) -> str:
        v = v.strip()
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_origins_raw.strip()
        if raw.startswith("["):
            try:
                items = json.loads(raw)
            except ValueError:
                items = []
        else:
            items = raw.split(",")
        return [str(i).strip().rstrip("/") for i in items if str(i).strip()]


settings = Settings()
