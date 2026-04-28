"""Internal service-to-service auth.

All internal endpoints (catalog write routes, cart internal read/clear,
checkout internal listing/refund) require this header. In prod the
network layer (security groups + internal ALB) is the primary defence;
this header is a second layer that catches mistakes like accidentally
exposing an internal route on the public ALB.
"""

from __future__ import annotations

import os
import secrets

from fastapi import Header, HTTPException, status


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("INTERNAL_API_KEY", "")
    if not expected:
        # Fail closed: if we forgot to configure the key, refuse all
        # internal calls rather than silently accepting them.
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "internal key not configured")
    if not x_internal_key or not secrets.compare_digest(x_internal_key, expected):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "internal access only")


def internal_headers() -> dict[str, str]:
    """Headers to attach when *calling* an internal endpoint."""
    return {"X-Internal-Key": os.environ.get("INTERNAL_API_KEY", "")}
