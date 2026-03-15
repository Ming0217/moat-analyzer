from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str  # server-side key (not anon key)

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    finnhub_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()  # type: ignore[call-arg]
