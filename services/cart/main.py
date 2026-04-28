"""Cart service.

Two pieces of state per customer, both in Redis (ElastiCache in prod):
  * cart:{user_id}     hash of product_id -> qty   (TTL 30 days)
  * wishlist:{user_id} set of product_ids          (TTL 365 days)

Carts are hydrated on every read by calling the catalog service so we
always show current name/price/stock. Wishlists hydrate the same way.
"""

from __future__ import annotations

import contextlib
import logging
import os
from typing import Optional

import redis
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pyshared.auth import TokenClaims
from pyshared.deps import require_customer
from pyshared.http_client import call as http_call
from pyshared.internal import require_internal_key
from pyshared.observability import RequestContextMiddleware, configure_logging


configure_logging("cart")
log = logging.getLogger("cart")

CART_TTL = 60 * 60 * 24 * 30          # 30 days
WISHLIST_TTL = 60 * 60 * 24 * 365     # 1 year


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    # warm the redis connection so the first request doesn't pay for it
    get_redis().ping()
    yield


app = FastAPI(title="ShopCloud Cart", lifespan=lifespan)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_redis: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
    return _redis


def _cart_key(user_id: str) -> str:
    return f"cart:{user_id}"


def _wishlist_key(user_id: str) -> str:
    return f"wishlist:{user_id}"


# ---------- DTOs ----------

class CartItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=1, le=999)


class CartLineOut(BaseModel):
    product_id: str
    qty: int
    name: str
    price_cents: int
    currency: str
    image_url: str
    line_total_cents: int
    in_stock: bool


class CartOut(BaseModel):
    user_id: str
    items: list[CartLineOut]
    subtotal_cents: int
    currency: str


class WishlistItemIn(BaseModel):
    product_id: str


class WishlistEntryOut(BaseModel):
    product_id: str
    name: str
    price_cents: int
    currency: str
    image_url: str
    stock: int


class WishlistOut(BaseModel):
    user_id: str
    items: list[WishlistEntryOut]


# ---------- catalog client ----------

def _catalog_url(path: str) -> str:
    return f"{os.environ['CATALOG_BASE_URL'].rstrip('/')}{path}"


def _fetch_product(product_id: str) -> Optional[dict]:
    r = http_call("GET", _catalog_url(f"/catalog/products/{product_id}"), timeout=5.0)
    if r.status_code == 404:
        return None
    if r.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            f"catalog error: {r.status_code}")
    return r.json()


# ---------- cart routes ----------

@app.get("/cart", response_model=CartOut)
def get_cart(claims: TokenClaims = Depends(require_customer)) -> CartOut:
    raw = get_redis().hgetall(_cart_key(claims.sub))
    return _hydrate_cart(claims.sub, raw)


@app.post("/cart/items", response_model=CartOut)
def add_item(item: CartItemIn,
             claims: TokenClaims = Depends(require_customer)) -> CartOut:
    p = _fetch_product(item.product_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")

    r = get_redis()
    key = _cart_key(claims.sub)
    # HINCRBY is atomic; concurrent calls are safe.
    r.hincrby(key, item.product_id, item.qty)
    r.expire(key, CART_TTL)
    return _hydrate_cart(claims.sub, r.hgetall(key))


@app.put("/cart/items/{product_id}", response_model=CartOut)
def set_item_qty(product_id: str, item: CartItemIn,
                 claims: TokenClaims = Depends(require_customer)) -> CartOut:
    if item.product_id != product_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "product_id mismatch")
    r = get_redis()
    key = _cart_key(claims.sub)
    r.hset(key, product_id, item.qty)
    r.expire(key, CART_TTL)
    return _hydrate_cart(claims.sub, r.hgetall(key))


@app.delete("/cart/items/{product_id}", response_model=CartOut)
def remove_item(product_id: str,
                claims: TokenClaims = Depends(require_customer)) -> CartOut:
    r = get_redis()
    key = _cart_key(claims.sub)
    r.hdel(key, product_id)
    return _hydrate_cart(claims.sub, r.hgetall(key))


@app.delete("/cart", response_model=CartOut)
def clear_cart(claims: TokenClaims = Depends(require_customer)) -> CartOut:
    get_redis().delete(_cart_key(claims.sub))
    return CartOut(user_id=claims.sub, items=[], subtotal_cents=0, currency="USD")


# ---------- internal cart endpoints (header-only auth) ----------

@app.get("/cart/internal/{user_id}", response_model=CartOut,
         dependencies=[Depends(require_internal_key)])
def read_cart_for_checkout(user_id: str) -> CartOut:
    return _hydrate_cart(user_id, get_redis().hgetall(_cart_key(user_id)))


@app.delete("/cart/internal/{user_id}", status_code=204, response_model=None,
            dependencies=[Depends(require_internal_key)])
def clear_cart_for_checkout(user_id: str) -> None:
    get_redis().delete(_cart_key(user_id))


# ---------- wishlist routes ----------

@app.get("/wishlist", response_model=WishlistOut)
def get_wishlist(claims: TokenClaims = Depends(require_customer)) -> WishlistOut:
    ids = list(get_redis().smembers(_wishlist_key(claims.sub)))
    items: list[WishlistEntryOut] = []
    for pid in ids:
        p = _fetch_product(pid)
        if not p:
            # product was deleted; quietly drop from wishlist
            get_redis().srem(_wishlist_key(claims.sub), pid)
            continue
        items.append(WishlistEntryOut(
            product_id=p["id"], name=p["name"],
            price_cents=p["price_cents"], currency=p["currency"],
            image_url=p["image_url"], stock=p["stock"],
        ))
    return WishlistOut(user_id=claims.sub, items=items)


@app.post("/wishlist/items", response_model=WishlistOut, status_code=201)
def add_wishlist_item(item: WishlistItemIn,
                      claims: TokenClaims = Depends(require_customer)) -> WishlistOut:
    p = _fetch_product(item.product_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
    r = get_redis()
    key = _wishlist_key(claims.sub)
    r.sadd(key, item.product_id)
    r.expire(key, WISHLIST_TTL)
    return get_wishlist(claims)


@app.delete("/wishlist/items/{product_id}", response_model=WishlistOut)
def remove_wishlist_item(product_id: str,
                         claims: TokenClaims = Depends(require_customer)) -> WishlistOut:
    get_redis().srem(_wishlist_key(claims.sub), product_id)
    return get_wishlist(claims)


# ---------- helpers ----------

def _hydrate_cart(user_id: str, raw: dict) -> CartOut:
    items: list[CartLineOut] = []
    subtotal = 0
    currency = "USD"

    for product_id, qty_str in raw.items():
        try:
            qty = int(qty_str)
        except (TypeError, ValueError):
            continue
        if qty <= 0:
            continue
        p = _fetch_product(product_id)
        if not p:
            continue
        line_total = p["price_cents"] * qty
        subtotal += line_total
        currency = p["currency"]
        items.append(CartLineOut(
            product_id=product_id, qty=qty,
            name=p["name"], price_cents=p["price_cents"],
            currency=p["currency"], image_url=p["image_url"],
            line_total_cents=line_total, in_stock=p["stock"] >= qty,
        ))

    return CartOut(user_id=user_id, items=items,
                   subtotal_cents=subtotal, currency=currency)


@app.get("/health")
@app.get("/healthz")
@app.get("/readyz")
def health() -> dict:
    redis_ok = True
    try:
        get_redis().ping()
    except Exception:
        redis_ok = False
    return {"status": "ok" if redis_ok else "degraded",
            "service": "cart", "redis": redis_ok}
