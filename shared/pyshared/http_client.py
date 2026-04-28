"""HTTP client used for service-to-service calls.

Wraps httpx with three behaviours we want everywhere:
  1. Forwards X-Request-Id so logs across services correlate.
  2. Retries idempotent calls (GET, DELETE, PUT) with exponential backoff
     on transient errors (connect errors, 502/503/504).
  3. Translates HTTP errors into FastAPI HTTPException so we don't leak
     upstream tracebacks to the customer.

POST is retried only on connect errors, never on 5xx — POSTs are not
necessarily idempotent (a POST that hit the server but failed on the way
back could be applied twice).
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import HTTPException, status

from .observability import current_request_id

log = logging.getLogger("httpcli")


_RETRYABLE_STATUSES = {502, 503, 504}
_IDEMPOTENT_METHODS = {"GET", "HEAD", "DELETE", "PUT"}


def _merge_headers(headers: dict[str, str] | None) -> dict[str, str]:
    out = dict(headers or {})
    out.setdefault("X-Request-Id", current_request_id())
    return out


def call(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json: Any = None,
    params: Any = None,
    timeout: float = 10.0,
    max_retries: int = 3,
) -> httpx.Response:
    method = method.upper()
    headers = _merge_headers(headers)

    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            r = httpx.request(method, url,
                              headers=headers, json=json, params=params,
                              timeout=timeout)
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as e:
            last_exc = e
            if attempt + 1 == max_retries:
                break
            time.sleep(0.1 * (2 ** attempt))
            continue

        # retry on transient 5xx for idempotent methods only
        if r.status_code in _RETRYABLE_STATUSES and method in _IDEMPOTENT_METHODS \
                and attempt + 1 < max_retries:
            time.sleep(0.1 * (2 ** attempt))
            continue
        return r

    log.warning("upstream call failed", extra={"url": url, "method": method,
                                                "error": str(last_exc)})
    raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                        f"upstream unreachable: {last_exc}")


def raise_for_upstream(r: httpx.Response) -> None:
    """Surface a clean HTTPException with the upstream's detail message."""
    if r.status_code < 400:
        return
    try:
        detail = r.json().get("detail", r.text)
    except Exception:
        detail = r.text or r.reason_phrase
    raise HTTPException(r.status_code, detail)
