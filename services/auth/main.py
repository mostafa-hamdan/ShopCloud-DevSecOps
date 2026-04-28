"""Auth service.

Handles:
  * customer self-serve registration / login
  * admin login (admins are seeded, no public registration)
  * customer profile (read/update name)
  * customer address book (list/add/update/delete/set-default)

Login is rate-limited to slow down credential-stuffing.
"""

from __future__ import annotations

import contextlib
import logging
import os
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

from pyshared.auth import TokenClaims, issue_token
from pyshared.db import transactional
from pyshared.deps import require_customer
from pyshared.internal import require_internal_key
from pyshared.observability import RequestContextMiddleware, configure_logging
from pyshared.ratelimit import RateLimiter, client_key

from . import db


configure_logging("auth")
log = logging.getLogger("auth")

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 10 failed logins per IP per minute is a generous demo number; tighten in prod.
login_limiter = RateLimiter(capacity=10, per_seconds=60.0)


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_engine()
    _seed_admin()
    yield


app = FastAPI(title="ShopCloud Auth", lifespan=lifespan)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- DTOs ----------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=255)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user_id: str
    email: str
    pool: Literal["customer", "admin"]


class ProfileOut(BaseModel):
    user_id: str
    email: str
    full_name: str


class ProfileUpdateIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)


class AddressIn(BaseModel):
    label: str = Field(default="Home", max_length=64)
    full_name: str = Field(min_length=1, max_length=255)
    line1: str = Field(min_length=1, max_length=255)
    line2: str = Field(default="", max_length=255)
    city: str = Field(min_length=1, max_length=120)
    region: str = Field(default="", max_length=120)
    postal_code: str = Field(default="", max_length=32)
    country: str = Field(min_length=2, max_length=2)
    is_default: bool = False


class AddressOut(AddressIn):
    id: str


# ---------- helpers ----------

def _seed_admin() -> None:
    email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL")
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD")
    if not email or not password:
        return
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        if s.query(db.Admin).filter_by(email=email).one_or_none():
            return
        s.add(db.Admin(email=email, password_hash=pwd.hash(password),
                       full_name="Bootstrap Admin"))
        s.commit()
        log.info("seeded bootstrap admin", extra={"email": email})


# ---------- customer auth ----------

@app.post("/auth/customer/register", response_model=TokenOut, status_code=201)
def register_customer(payload: RegisterIn) -> TokenOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        if s.query(db.Customer).filter_by(email=payload.email).one_or_none():
            raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
        c = db.Customer(
            email=payload.email,
            password_hash=pwd.hash(payload.password),
            full_name=payload.full_name,
        )
        s.add(c)
        s.commit()
        s.refresh(c)
        token = issue_token(c.id, c.email, "customer")
        log.info("customer registered", extra={"user_id": c.id})
        return TokenOut(access_token=token, user_id=c.id, email=c.email, pool="customer")


@app.post("/auth/customer/login", response_model=TokenOut)
def login_customer(payload: LoginIn, request: Request) -> TokenOut:
    login_limiter.check(f"customer:{client_key(request)}")
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        c = s.query(db.Customer).filter_by(email=payload.email).one_or_none()
        if not c or not pwd.verify(payload.password, c.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
        token = issue_token(c.id, c.email, "customer")
        return TokenOut(access_token=token, user_id=c.id, email=c.email, pool="customer")


# ---------- admin auth ----------

@app.post("/auth/admin/login", response_model=TokenOut)
def login_admin(payload: LoginIn, request: Request) -> TokenOut:
    login_limiter.check(f"admin:{client_key(request)}")
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        a = s.query(db.Admin).filter_by(email=payload.email).one_or_none()
        if not a or not pwd.verify(payload.password, a.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
        token = issue_token(a.id, a.email, "admin")
        return TokenOut(access_token=token, user_id=a.id, email=a.email, pool="admin")


# ---------- customer profile ----------

@app.get("/auth/me", response_model=ProfileOut)
def get_me(claims: TokenClaims = Depends(require_customer)) -> ProfileOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        c = s.get(db.Customer, claims.sub)
        if not c:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
        return ProfileOut(user_id=c.id, email=c.email, full_name=c.full_name)


@app.patch("/auth/me", response_model=ProfileOut)
def update_me(payload: ProfileUpdateIn,
              claims: TokenClaims = Depends(require_customer)) -> ProfileOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        c = s.get(db.Customer, claims.sub)
        if not c:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
        c.full_name = payload.full_name
        s.commit()
        s.refresh(c)
        return ProfileOut(user_id=c.id, email=c.email, full_name=c.full_name)


# ---------- address book ----------

def _addr_to_out(a: db.Address) -> AddressOut:
    return AddressOut(
        id=a.id, label=a.label, full_name=a.full_name,
        line1=a.line1, line2=a.line2, city=a.city, region=a.region,
        postal_code=a.postal_code, country=a.country, is_default=a.is_default,
    )


@app.get("/auth/me/addresses", response_model=list[AddressOut])
def list_addresses(claims: TokenClaims = Depends(require_customer)) -> list[AddressOut]:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        rows = s.query(db.Address).filter_by(customer_id=claims.sub) \
                .order_by(db.Address.is_default.desc(), db.Address.created_at).all()
        return [_addr_to_out(a) for a in rows]


@app.post("/auth/me/addresses", response_model=AddressOut, status_code=201)
def add_address(payload: AddressIn,
                claims: TokenClaims = Depends(require_customer)) -> AddressOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        # If the new address is default, unset the old default.
        if payload.is_default:
            s.query(db.Address).filter_by(customer_id=claims.sub, is_default=True) \
                    .update({"is_default": False})
        # If this is the customer's first address, force is_default=True so
        # checkout always has something to use.
        existing = s.query(db.Address).filter_by(customer_id=claims.sub).count()
        is_default = payload.is_default or existing == 0
        a = db.Address(customer_id=claims.sub, **payload.model_dump(exclude={"is_default"}),
                       is_default=is_default)
        s.add(a)
        s.commit()
        s.refresh(a)
        return _addr_to_out(a)


@app.patch("/auth/me/addresses/{address_id}", response_model=AddressOut)
def update_address(address_id: str, payload: AddressIn,
                   claims: TokenClaims = Depends(require_customer)) -> AddressOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        a = s.get(db.Address, address_id)
        if not a or a.customer_id != claims.sub:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "address not found")
        if payload.is_default and not a.is_default:
            s.query(db.Address).filter_by(customer_id=claims.sub, is_default=True) \
                    .update({"is_default": False})
        for field, value in payload.model_dump().items():
            setattr(a, field, value)
        s.commit()
        s.refresh(a)
        return _addr_to_out(a)


@app.delete("/auth/me/addresses/{address_id}", status_code=204, response_model=None)
def delete_address(address_id: str,
                   claims: TokenClaims = Depends(require_customer)) -> None:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        a = s.get(db.Address, address_id)
        if not a or a.customer_id != claims.sub:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "address not found")
        was_default = a.is_default
        s.delete(a)
        s.flush()
        if was_default:
            # promote the oldest remaining address to default
            next_default = s.query(db.Address) \
                .filter_by(customer_id=claims.sub) \
                .order_by(db.Address.created_at).first()
            if next_default:
                next_default.is_default = True
        s.commit()


# ---------- internal: customer lookup for admin ----------

@app.get("/auth/internal/customers", dependencies=[Depends(require_internal_key)])
def list_customers_internal(
    q: str | None = None,
    limit: int = 50, offset: int = 0,
) -> dict:
    """Used by the admin service to power the customer list page."""
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        query = s.query(db.Customer)
        if q:
            like = f"%{q.lower()}%"
            query = query.filter(
                (db.Customer.email.ilike(like)) | (db.Customer.full_name.ilike(like))
            )
        total = query.count()
        rows = query.order_by(db.Customer.created_at.desc()) \
                .offset(offset).limit(limit).all()
        return {
            "total": total,
            "items": [
                {"id": c.id, "email": c.email, "full_name": c.full_name,
                 "created_at": c.created_at.isoformat()}
                for c in rows
            ],
        }


# ---------- health ----------

@app.get("/health")
@app.get("/healthz")
@app.get("/readyz")
def health() -> dict:
    return {"status": "ok", "service": "auth"}
