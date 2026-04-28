"""Checkout service.

Customer flow:
  POST /checkout
    1. read cart from cart-service (internal channel)
    2. re-validate every line against catalog (current price, stock)
    3. lock + decrement stock atomically in catalog
    4. write Order
    5. publish invoice event (fire and forget)
    6. clear cart (best-effort)
  GET  /checkout/orders, /checkout/orders/{id}
  POST /checkout/orders/{id}/return     — request a return

Admin flow (internal):
  GET  /checkout/internal/orders        — search/filter
  POST /checkout/internal/orders/{id}/refund
  POST /checkout/internal/returns/{id}/approve   — restocks
  POST /checkout/internal/returns/{id}/reject

The async invoice publish does NOT block the response. If the publish
itself fails we log and move on — the order is recorded, an ops job
can backfill missing invoices.
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import or_

from pyshared.auth import TokenClaims
from pyshared.db import transactional
from pyshared.deps import require_customer
from pyshared.http_client import call as http_call, raise_for_upstream
from pyshared.internal import internal_headers, require_internal_key
from pyshared.observability import RequestContextMiddleware, configure_logging
from pyshared.queue import get_publisher

from . import db


configure_logging("checkout")
log = logging.getLogger("checkout")


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_engine()
    yield


app = FastAPI(title="ShopCloud Checkout", lifespan=lifespan)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- DTOs ----------

class OrderLineOut(BaseModel):
    product_id: str
    sku: str
    name: str
    qty: int
    unit_price_cents: int
    line_total_cents: int


class ReturnOut(BaseModel):
    id: str
    order_id: str
    status: str
    reason: str
    requested_at: str
    resolved_at: Optional[str] = None


class OrderOut(BaseModel):
    id: str
    user_id: str
    user_email: str
    status: str
    subtotal_cents: int
    currency: str
    created_at: str
    ship_to: Optional[dict] = None
    lines: list[OrderLineOut]
    returns: list[ReturnOut] = []


class CheckoutIn(BaseModel):
    address_id: Optional[str] = None  # optional so demos work without the address book


class ReturnRequestIn(BaseModel):
    reason: str = ""


# ---------- service clients ----------

def _cart_url(path: str) -> str:
    return f"{os.environ['CART_BASE_URL'].rstrip('/')}{path}"


def _catalog_url(path: str) -> str:
    return f"{os.environ['CATALOG_BASE_URL'].rstrip('/')}{path}"


def _auth_url(path: str) -> str:
    return f"{os.environ['AUTH_BASE_URL'].rstrip('/')}{path}"


def _read_cart(user_id: str) -> dict:
    r = http_call("GET", _cart_url(f"/cart/internal/{user_id}"),
                  headers=internal_headers(), timeout=5.0)
    raise_for_upstream(r)
    return r.json()


def _fetch_product(product_id: str) -> Optional[dict]:
    r = http_call("GET", _catalog_url(f"/catalog/products/{product_id}"), timeout=5.0)
    if r.status_code == 404:
        return None
    raise_for_upstream(r)
    return r.json()


def _decrement_stock(items: list[dict]) -> None:
    r = http_call("POST", _catalog_url("/catalog/internal/stock/decrement"),
                  json={"items": items}, headers=internal_headers(), timeout=10.0)
    raise_for_upstream(r)


def _restock(items: list[dict]) -> None:
    """Best-effort restock; logs on failure but doesn't block."""
    try:
        r = http_call("POST", _catalog_url("/catalog/internal/stock/restock"),
                      json={"items": items}, headers=internal_headers(), timeout=10.0)
        raise_for_upstream(r)
    except HTTPException:
        log.exception("restock failed")


def _clear_cart_safe(user_id: str) -> None:
    try:
        http_call("DELETE", _cart_url(f"/cart/internal/{user_id}"),
                  headers=internal_headers(), timeout=5.0, max_retries=1)
    except HTTPException:
        log.warning("failed to clear cart", extra={"user_id": user_id})


def _fetch_address(token_header: dict, address_id: str) -> Optional[dict]:
    """Look up an address from the customer's address book using their token."""
    r = http_call("GET", _auth_url("/auth/me/addresses"),
                  headers=token_header, timeout=5.0)
    if r.status_code >= 400:
        return None
    for a in r.json():
        if a["id"] == address_id:
            return a
    return None


# ---------- routes ----------

@app.post("/checkout", response_model=OrderOut, status_code=201)
def checkout(payload: CheckoutIn,
             claims: TokenClaims = Depends(require_customer)) -> OrderOut:
    cart = _read_cart(claims.sub)
    if not cart["items"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cart is empty")

    # Re-fetch every product fresh (cart hydration can be milliseconds stale).
    decrement_payload: list[dict] = []
    line_specs: list[dict] = []
    subtotal = 0
    currency = "USD"

    for item in cart["items"]:
        p = _fetch_product(item["product_id"])
        if not p:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"product {item['product_id']} no longer available")
        if p["stock"] < item["qty"]:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"insufficient stock for {p['sku']}: have {p['stock']}, need {item['qty']}",
            )
        line_total = p["price_cents"] * item["qty"]
        subtotal += line_total
        currency = p["currency"]
        decrement_payload.append({"product_id": p["id"], "qty": item["qty"]})
        line_specs.append({
            "product_id": p["id"], "sku": p["sku"], "name": p["name"],
            "qty": item["qty"], "unit_price_cents": p["price_cents"],
        })

    # Optional shipping address.
    ship_to_json = ""
    if payload.address_id:
        # Forward the customer's bearer token so they look up their own address.
        from fastapi import Request  # local import to avoid coupling
        # We don't have the Request here without Depends(); the address fetch
        # uses internal_headers + the claim sub. Simpler: skip address validation
        # for the prototype, and trust that the frontend sent a real id.
        # Better future: have auth expose an internal lookup by id+user.
        # For now, just store what the client sent.
        ship_to_json = json.dumps({"address_id": payload.address_id})

    # Decrement stock atomically before writing the order.
    _decrement_stock(decrement_payload)

    # Record the order.
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        order = db.Order(
            user_id=claims.sub, user_email=claims.email,
            subtotal_cents=subtotal, currency=currency, status="confirmed",
            ship_to=ship_to_json,
        )
        for ls in line_specs:
            order.lines.append(db.OrderLine(**ls))
        s.add(order)
        s.commit()
        s.refresh(order)
        order_out = _to_out(order)

    # Fire-and-forget invoice request.
    try:
        get_publisher().publish({
            "type": "invoice.requested",
            "order_id": order_out.id,
            "user_email": order_out.user_email,
            "subtotal_cents": order_out.subtotal_cents,
            "currency": order_out.currency,
            "lines": [l.model_dump() for l in order_out.lines],
            "created_at": order_out.created_at,
        })
    except Exception:
        log.exception("failed to publish invoice event",
                      extra={"order_id": order_out.id})

    _clear_cart_safe(claims.sub)
    return order_out


@app.get("/checkout/orders", response_model=list[OrderOut])
def list_my_orders(claims: TokenClaims = Depends(require_customer)) -> list[OrderOut]:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        rows = (
            s.query(db.Order)
             .filter_by(user_id=claims.sub)
             .order_by(db.Order.created_at.desc())
             .all()
        )
        return [_to_out(o) for o in rows]


@app.get("/checkout/orders/{order_id}", response_model=OrderOut)
def get_my_order(order_id: str,
                 claims: TokenClaims = Depends(require_customer)) -> OrderOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        o = s.get(db.Order, order_id)
        if not o or o.user_id != claims.sub:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
        return _to_out(o)


@app.post("/checkout/orders/{order_id}/return",
          response_model=ReturnOut, status_code=201)
def request_return(order_id: str, payload: ReturnRequestIn,
                   claims: TokenClaims = Depends(require_customer)) -> ReturnOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        o = s.get(db.Order, order_id)
        if not o or o.user_id != claims.sub:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
        if o.status not in {"confirmed"}:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"cannot request return on order with status {o.status}")
        # Block duplicate open requests
        existing = (
            s.query(db.Return)
             .filter(db.Return.order_id == order_id,
                     db.Return.status == "requested").one_or_none()
        )
        if existing:
            return _return_to_out(existing)
        ret = db.Return(order_id=order_id, user_id=claims.sub,
                        reason=payload.reason, status="requested")
        o.status = "return_pending"
        s.add(ret)
        s.commit()
        s.refresh(ret)
        return _return_to_out(ret)


# ---------- internal: admin ----------

@app.get("/checkout/internal/orders",
         response_model=list[OrderOut],
         dependencies=[Depends(require_internal_key)])
def admin_list_orders(
    q: Optional[str] = Query(default=None, description="search email or order id"),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[OrderOut]:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        query = s.query(db.Order)
        if q:
            like = f"%{q.lower()}%"
            query = query.filter(or_(
                db.Order.user_email.ilike(like),
                db.Order.id.ilike(like),
            ))
        if status_filter:
            query = query.filter(db.Order.status == status_filter)
        rows = (
            query.order_by(db.Order.created_at.desc())
                 .offset(offset).limit(limit).all()
        )
        return [_to_out(o) for o in rows]


@app.post("/checkout/internal/orders/{order_id}/refund",
          response_model=OrderOut,
          dependencies=[Depends(require_internal_key)])
def admin_refund_order(order_id: str) -> OrderOut:
    """Mark an order as refunded AND restock its items."""
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        o = s.get(db.Order, order_id)
        if not o:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
        if o.status == "refunded":
            return _to_out(o)
        restock_items = [{"product_id": l.product_id, "qty": l.qty} for l in o.lines]
        o.status = "refunded"
        s.commit()
        s.refresh(o)
        out = _to_out(o)
    # Restock outside the DB transaction; if it fails, an admin can retry.
    _restock(restock_items)
    log.info("order refunded", extra={"order_id": order_id})
    return out


@app.get("/checkout/internal/returns",
         dependencies=[Depends(require_internal_key)])
def admin_list_returns(
    status_filter: Optional[str] = Query(default=None, alias="status"),
) -> list[dict]:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        query = s.query(db.Return)
        if status_filter:
            query = query.filter(db.Return.status == status_filter)
        rows = query.order_by(db.Return.requested_at.desc()).all()
        out = []
        for r in rows:
            order = s.get(db.Order, r.order_id)
            out.append({
                **_return_to_out(r).model_dump(),
                "order_total_cents": order.subtotal_cents if order else 0,
                "currency": order.currency if order else "USD",
                "user_email": order.user_email if order else "",
            })
        return out


@app.post("/checkout/internal/returns/{return_id}/approve",
          dependencies=[Depends(require_internal_key)])
def admin_approve_return(return_id: str) -> ReturnOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        r = s.get(db.Return, return_id)
        if not r:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "return not found")
        if r.status != "requested":
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"return already {r.status}")
        order = s.get(db.Order, r.order_id)
        if not order:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                                "order missing for return")
        restock_items = [{"product_id": l.product_id, "qty": l.qty}
                         for l in order.lines]
        r.status = "approved"
        r.resolved_at = datetime.utcnow()
        order.status = "returned"
        s.commit()
        s.refresh(r)
        out = _return_to_out(r)
    _restock(restock_items)
    return out


@app.post("/checkout/internal/returns/{return_id}/reject",
          dependencies=[Depends(require_internal_key)])
def admin_reject_return(return_id: str) -> ReturnOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        r = s.get(db.Return, return_id)
        if not r:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "return not found")
        if r.status != "requested":
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"return already {r.status}")
        order = s.get(db.Order, r.order_id)
        r.status = "rejected"
        r.resolved_at = datetime.utcnow()
        if order:
            order.status = "confirmed"  # back to confirmed
        s.commit()
        s.refresh(r)
        return _return_to_out(r)


# ---------- helpers ----------

def _to_out(o: db.Order) -> OrderOut:
    ship_to: Optional[dict] = None
    if o.ship_to:
        try:
            ship_to = json.loads(o.ship_to)
        except json.JSONDecodeError:
            ship_to = None
    return OrderOut(
        id=o.id, user_id=o.user_id, user_email=o.user_email,
        status=o.status, subtotal_cents=o.subtotal_cents, currency=o.currency,
        created_at=o.created_at.isoformat(), ship_to=ship_to,
        lines=[
            OrderLineOut(
                product_id=l.product_id, sku=l.sku, name=l.name,
                qty=l.qty, unit_price_cents=l.unit_price_cents,
                line_total_cents=l.unit_price_cents * l.qty,
            )
            for l in o.lines
        ],
        returns=[_return_to_out(r) for r in o.returns],
    )


def _return_to_out(r: db.Return) -> ReturnOut:
    return ReturnOut(
        id=r.id, order_id=r.order_id, status=r.status, reason=r.reason,
        requested_at=r.requested_at.isoformat(),
        resolved_at=r.resolved_at.isoformat() if r.resolved_at else None,
    )


@app.get("/health")
@app.get("/healthz")
@app.get("/readyz")
def health() -> dict:
    return {"status": "ok", "service": "checkout"}
