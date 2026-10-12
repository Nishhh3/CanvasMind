from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hackathon API"
    database_url: str = "sqlite:///./app.db"
    cors_origins: list[str] = ["http://localhost:3000"]
    openrouter_api_key: str = ""
    llm_model: str = "openrouter/auto"
    vision_model: str = ""  # empty -> falls back to llm_model

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
