"""Admin service.

No DB. Every endpoint requires an admin-pool JWT and proxies to
catalog / checkout / auth via the internal channel. This service is
what sits behind the internal ALB; the admin Next.js app is the only
caller in production.
"""

from __future__ import annotations

import contextlib
import logging
import os
from typing import Optional

from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pyshared.auth import TokenClaims
from pyshared.deps import require_admin
from pyshared.http_client import call as http_call, raise_for_upstream
from pyshared.internal import internal_headers
from pyshared.observability import RequestContextMiddleware, configure_logging


configure_logging("admin")
log = logging.getLogger("admin")


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(title="ShopCloud Admin", lifespan=lifespan)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ADMIN_CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- DTOs (mirror upstream shapes) ----------

class ProductCreateIn(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    price_cents: int = Field(ge=0)
    currency: str = "USD"
    image_url: str = ""
    stock: int = Field(ge=0, default=0)
    category_slug: Optional[str] = None


class ProductUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_cents: Optional[int] = Field(default=None, ge=0)
    image_url: Optional[str] = None
    stock: Optional[int] = Field(default=None, ge=0)
    category_slug: Optional[str] = None


class AdminLoginIn(BaseModel):
    email: str
    password: str


# ---------- helpers ----------

def _catalog_url(path: str) -> str:
    return f"{os.environ['CATALOG_BASE_URL'].rstrip('/')}{path}"


def _checkout_url(path: str) -> str:
    return f"{os.environ['CHECKOUT_BASE_URL'].rstrip('/')}{path}"


def _auth_url(path: str) -> str:
    return f"{os.environ['AUTH_BASE_URL'].rstrip('/')}{path}"


def _proxy(method: str, url: str, **kwargs):
    r = http_call(method, url, headers=internal_headers(), **kwargs)
    raise_for_upstream(r)
    if r.status_code == 204 or not r.content:
        return None
    return r.json()


def _proxy_auth_login(url: str, payload: dict):
    r = http_call("POST", url, json=payload, timeout=10.0)
    raise_for_upstream(r)
    return r.json()


# ---------- admin login ----------

@app.post("/admin/login")
def admin_login(payload: AdminLoginIn):
    return _proxy_auth_login(_auth_url("/auth/admin/login"), payload.model_dump())


# ---------- products ----------

@app.get("/admin/products")
def list_products(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _claims: TokenClaims = Depends(require_admin),
):
    return _proxy("GET", _catalog_url("/catalog/products"),
                  params={"q": q, "limit": limit, "offset": offset})


@app.get("/admin/products/{product_id}")
def get_product(product_id: str, _claims: TokenClaims = Depends(require_admin)):
    return _proxy("GET", _catalog_url(f"/catalog/products/{product_id}"))


@app.post("/admin/products", status_code=201)
def create_product(payload: ProductCreateIn,
                   _claims: TokenClaims = Depends(require_admin)):
    return _proxy("POST", _catalog_url("/catalog/internal/products"),
                  json=payload.model_dump())


@app.patch("/admin/products/{product_id}")
def update_product(product_id: str, payload: ProductUpdateIn,
                   _claims: TokenClaims = Depends(require_admin)):
    return _proxy("PATCH", _catalog_url(f"/catalog/internal/products/{product_id}"),
                  json=payload.model_dump(exclude_unset=True))


@app.delete("/admin/products/{product_id}", status_code=204, response_model=None)
def delete_product(product_id: str,
                   _claims: TokenClaims = Depends(require_admin)):
    _proxy("DELETE", _catalog_url(f"/catalog/internal/products/{product_id}"))


@app.get("/admin/categories")
def list_categories(_claims: TokenClaims = Depends(require_admin)):
    return _proxy("GET", _catalog_url("/catalog/categories"))


# ---------- orders / refunds ----------

@app.get("/admin/orders")
def list_orders(
    q: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _claims: TokenClaims = Depends(require_admin),
):
    return _proxy("GET", _checkout_url("/checkout/internal/orders"),
                  params={"q": q, "status": status, "limit": limit, "offset": offset})


@app.post("/admin/orders/{order_id}/refund")
def refund_order(order_id: str,
                 _claims: TokenClaims = Depends(require_admin)):
    return _proxy("POST", _checkout_url(f"/checkout/internal/orders/{order_id}/refund"))


# ---------- returns ----------

@app.get("/admin/returns")
def list_returns(
    status: Optional[str] = Query(default=None),
    _claims: TokenClaims = Depends(require_admin),
):
    return _proxy("GET", _checkout_url("/checkout/internal/returns"),
                  params={"status": status})


@app.post("/admin/returns/{return_id}/approve")
def approve_return(return_id: str,
                   _claims: TokenClaims = Depends(require_admin)):
    return _proxy("POST", _checkout_url(f"/checkout/internal/returns/{return_id}/approve"))


@app.post("/admin/returns/{return_id}/reject")
def reject_return(return_id: str,
                  _claims: TokenClaims = Depends(require_admin)):
    return _proxy("POST", _checkout_url(f"/checkout/internal/returns/{return_id}/reject"))


# ---------- customers ----------

@app.get("/admin/customers")
def list_customers(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _claims: TokenClaims = Depends(require_admin),
):
    return _proxy("GET", _auth_url("/auth/internal/customers"),
                  params={"q": q, "limit": limit, "offset": offset})


@app.get("/health")
@app.get("/healthz")
@app.get("/readyz")
def health() -> dict:
    return {"status": "ok", "service": "admin"}
