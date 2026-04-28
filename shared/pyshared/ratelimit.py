"""In-process rate limiter.

Token-bucket-ish: each key gets ``capacity`` requests, refilled at
``per_seconds``. Sufficient for blunting credential-stuffing in a single
replica. In production behind multiple EKS pods we'd back this with
ElastiCache or use the WAF rate-based rule.
"""

from __future__ import annotations

import threading
import time
from collections import deque

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self, capacity: int, per_seconds: float):
        self.capacity = capacity
        self.per_seconds = per_seconds
        self._buckets: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._buckets.setdefault(key, deque())
            # drop entries older than the window
            cutoff = now - self.per_seconds
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self.capacity:
                return False
            bucket.append(now)
            return True

    def check(self, key: str) -> None:
        if not self._allow(key):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "too many requests",
            )


def client_key(request: Request) -> str:
    # Behind an ALB the client IP is in X-Forwarded-For. Trust it only
    # when the deployment sets TRUST_FORWARDED_FOR=1.
    import os
    if os.environ.get("TRUST_FORWARDED_FOR") == "1":
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
