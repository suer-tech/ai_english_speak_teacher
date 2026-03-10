from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "SpeakAI API"
    app_env: str = "development"
    app_debug: bool = True

    database_url: str = "sqlite:///./speakai.db"
    frontend_url: str = "http://localhost:3000"

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4.1-mini"

    salute_speech_api_key: str = ""
    salute_speech_auth_url: str = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    salute_speech_scope: str = "SALUTE_SPEECH_PERS"
    salute_speech_base_url: str = "https://smartspeech.sber.ru/rest/v1"
    salute_speech_grpc_host: str = "smartspeech.sber.ru"
    salute_speech_default_voice: str = "Kin_24000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
