"""FastAPI dependencies for auth. Imported by every service that needs to
gate routes on a customer or admin token."""

from __future__ import annotations

from typing import Literal

from fastapi import Depends, Header, HTTPException, status

from .auth import TokenClaims, TokenError, verify_token


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing or malformed Authorization header",
        )
    return authorization.split(" ", 1)[1].strip()


def current_user(authorization: str | None = Header(default=None)) -> TokenClaims:
    """Any authenticated user (customer or admin)."""
    token = _extract_bearer(authorization)
    try:
        return verify_token(token)
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"invalid token: {e}",
        )


def require_pool(pool: Literal["customer", "admin"]):
    """Dependency factory that locks a route to a specific user pool."""
    def _dep(claims: TokenClaims = Depends(current_user)) -> TokenClaims:
        if claims.pool != pool:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"token belongs to {claims.pool} pool, this route requires {pool}",
            )
        return claims
    return _dep


require_customer = require_pool("customer")
require_admin = require_pool("admin")
