from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 1 day; refresh keeps the session alive
    refresh_token_expire_days: int = 365      # effectively "stay signed in until logout"
    allowed_origins: str = "http://localhost:5173"
    # Public HTTPS base URL of this backend, used to register Telegram webhooks
    # (e.g. https://track-it-backend.up.railway.app). Empty disables auto-setup.
    public_base_url: str = ""

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
