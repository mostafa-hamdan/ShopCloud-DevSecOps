from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "shopcloud-service"
    app_env: str = "dev"
    database_url: str | None = None
    redis_url: str | None = None
    customer_demo_token: str = Field(default="customer-demo-token")
    admin_demo_token: str = Field(default="admin-demo-token")
    cors_origins: str = "http://localhost:3000"
    events_path: str = "/app/runtime/events"
    invoice_storage_path: str = "/app/runtime/invoices"
    invoice_outbox_path: str = "/app/runtime/outbox"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()