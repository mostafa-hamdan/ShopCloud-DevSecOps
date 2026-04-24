from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .logging import configure_logging


def create_app(service_name: str) -> FastAPI:
    settings = get_settings()
    configure_logging(service_name)
    app = FastAPI(title=service_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def healthz() -> dict:
        return {"status": "ok", "service": service_name}

    @app.get("/readyz")
    def readyz() -> dict:
        return {"status": "ready", "service": service_name}

    return app