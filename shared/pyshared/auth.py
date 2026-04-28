"""JWT issuing and verification.

Two modes, controlled by JWT_VERIFIER env:
  * ``local`` (dev/test) — HS256 with a shared secret. The auth service
    issues these. Used by docker-compose and pytest.
  * ``cognito`` (prod)   — RS256 verified against AWS Cognito's JWKS.
    Two user pools (customer + admin); the verifier figures out which
    pool a token belongs to from its `iss` claim and validates against
    that pool's JWKS specifically.

Both paths return the same TokenClaims object so service code is
verifier-agnostic.

Required env in prod (JWT_VERIFIER=cognito):
  COGNITO_REGION
  COGNITO_CUSTOMER_POOL_ID
  COGNITO_CUSTOMER_CLIENT_ID
  COGNITO_ADMIN_POOL_ID
  COGNITO_ADMIN_CLIENT_ID
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Literal, Optional

import jwt
from jwt import PyJWKClient

UserPool = Literal["customer", "admin"]


@dataclass
class TokenClaims:
    sub: str          # user id (Cognito 'sub' claim)
    email: str
    pool: UserPool    # which pool the token came from
    exp: int


class TokenError(Exception):
    pass


# ---------- issuing (dev only — prod issues via Cognito directly) ----------

def issue_token(user_id: str, email: str, pool: UserPool, ttl_seconds: int = 3600) -> str:
    """Mint an HS256 token. Only the auth service in local mode calls this."""
    secret = os.environ["JWT_SECRET"]
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "pool": pool,
        "iat": now,
        "exp": now + ttl_seconds,
        "iss": os.environ.get("JWT_ISSUER", "shopcloud-auth-dev"),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


# ---------- Cognito verification ----------

# JWKS clients are cached per-pool because PyJWKClient does its own keyset
# caching and we don't want to re-download the keyset on every request.
_jwk_clients: dict[str, PyJWKClient] = {}


def _cognito_issuer(pool_id: str) -> str:
    region = os.environ["COGNITO_REGION"]
    return f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"


def _cognito_jwks_url(pool_id: str) -> str:
    return f"{_cognito_issuer(pool_id)}/.well-known/jwks.json"


def _jwk_client_for(pool_id: str) -> PyJWKClient:
    if pool_id not in _jwk_clients:
        _jwk_clients[pool_id] = PyJWKClient(_cognito_jwks_url(pool_id))
    return _jwk_clients[pool_id]


def _verify_cognito(token: str) -> TokenClaims:
    """Verify a Cognito-issued RS256 token.

    The token's `iss` tells us which pool issued it. We map that to one
    of our two configured pools, then verify against THAT pool's JWKS
    (not "any pool" — that would let a customer token impersonate an
    admin if their pool was misconfigured).
    """
    customer_pool = os.environ["COGNITO_CUSTOMER_POOL_ID"]
    admin_pool = os.environ["COGNITO_ADMIN_POOL_ID"]
    customer_aud = os.environ["COGNITO_CUSTOMER_CLIENT_ID"]
    admin_aud = os.environ["COGNITO_ADMIN_CLIENT_ID"]

    # Read the unverified header/claims first so we know which JWKS to use.
    # We do NOT trust these for anything security-relevant — they're only
    # used to pick the verification key.
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
    except jwt.PyJWTError as e:
        raise TokenError(f"malformed token: {e}") from e

    iss = unverified.get("iss", "")
    if iss == _cognito_issuer(customer_pool):
        pool: UserPool = "customer"
        pool_id = customer_pool
        audience = customer_aud
    elif iss == _cognito_issuer(admin_pool):
        pool = "admin"
        pool_id = admin_pool
        audience = admin_aud
    else:
        raise TokenError(f"unknown issuer: {iss}")

    try:
        signing_key = _jwk_client_for(pool_id).get_signing_key_from_jwt(token).key
        decoded = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=_cognito_issuer(pool_id),
            # Cognito ID tokens use "aud"; access tokens use "client_id".
            # We accept either by passing audience= and falling back below.
            audience=audience,
            options={"require": ["exp", "sub", "iss"]},
        )
    except jwt.InvalidAudienceError:
        # Cognito ACCESS tokens have no `aud`, only `client_id`. Re-decode
        # without audience and check client_id manually.
        try:
            decoded = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                issuer=_cognito_issuer(pool_id),
                options={"require": ["exp", "sub", "iss"], "verify_aud": False},
            )
            if decoded.get("client_id") != audience:
                raise TokenError("client_id mismatch")
        except jwt.PyJWTError as e:
            raise TokenError(str(e)) from e
    except jwt.PyJWTError as e:
        raise TokenError(str(e)) from e

    return TokenClaims(
        sub=decoded["sub"],
        email=decoded.get("email", ""),
        pool=pool,
        exp=decoded["exp"],
    )


# ---------- local HS256 verification ----------

def _verify_local(token: str) -> TokenClaims:
    secret = os.environ["JWT_SECRET"]
    try:
        decoded = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise TokenError(str(e)) from e

    pool = decoded.get("pool")
    if pool not in ("customer", "admin"):
        raise TokenError(f"invalid pool: {pool}")

    return TokenClaims(
        sub=decoded["sub"],
        email=decoded.get("email", ""),
        pool=pool,
        exp=decoded["exp"],
    )


# ---------- public API ----------

def verify_token(token: str) -> TokenClaims:
    backend = os.environ.get("JWT_VERIFIER", "local")
    if backend == "cognito":
        return _verify_cognito(token)
    return _verify_local(token)
