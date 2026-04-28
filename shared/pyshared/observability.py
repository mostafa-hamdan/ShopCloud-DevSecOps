"""Request-ID + structured logging.

Every incoming request gets an ID. We propagate it on outbound calls
(via the http_client helper) so a single user action shows up under
the same ID across all services. In prod this maps to AWS X-Ray /
ALB request IDs.
"""

from __future__ import annotations

import contextvars
import json
import logging
import sys
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
service_name_var: contextvars.ContextVar[str] = contextvars.ContextVar("service_name", default="-")


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "service": service_name_var.get(),
            "request_id": request_id_var.get(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for k, v in record.__dict__.items():
            # let callers attach extra fields with logger.info("...", extra={"foo": "bar"})
            if k not in {"args", "msg", "levelname", "name", "exc_info", "exc_text",
                         "stack_info", "lineno", "pathname", "filename", "module",
                         "funcName", "created", "msecs", "relativeCreated", "thread",
                         "threadName", "processName", "process", "message"}:
                payload[k] = v
        return json.dumps(payload, default=str)


def configure_logging(service_name: str, level: int = logging.INFO) -> None:
    service_name_var.set(service_name)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger()
    # remove any pre-existing handlers (uvicorn adds one)
    for h in list(root.handlers):
        root.removeHandler(h)
    root.addHandler(handler)
    root.setLevel(level)
    # quiet down access logs — we'll emit our own per-request log
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach request-id to ContextVar so logs and outbound calls pick it up.
    Accept an inbound X-Request-Id if present (so it propagates across services),
    otherwise mint a new one."""

    async def dispatch(self, request: Request, call_next) -> Response:
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = request_id_var.set(rid)
        log = logging.getLogger("http")
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            log.exception("request failed",
                          extra={"method": request.method, "path": request.url.path,
                                 "elapsed_ms": round(elapsed_ms, 2)})
            request_id_var.reset(token)
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        log.info("request",
                 extra={"method": request.method, "path": request.url.path,
                        "status": response.status_code,
                        "elapsed_ms": round(elapsed_ms, 2)})
        response.headers["x-request-id"] = rid
        request_id_var.reset(token)
        return response


def current_request_id() -> str:
    return request_id_var.get()
