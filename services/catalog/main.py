"""Catalog service.

Public reads: anyone can list/search/get products and read reviews.
Customer-auth: posting/deleting your own reviews.
Internal: product CRUD, atomic stock decrement, stock restock (used by
checkout's refund-with-restock flow).
"""

from __future__ import annotations

import contextlib
import logging
import os
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import lazyload

from pyshared.auth import TokenClaims
from pyshared.db import transactional
from pyshared.deps import require_customer
from pyshared.internal import require_internal_key
from pyshared.observability import RequestContextMiddleware, configure_logging

from . import db


configure_logging("catalog")
log = logging.getLogger("catalog")


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_engine()
    yield


app = FastAPI(title="ShopCloud Catalog", lifespan=lifespan)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- DTOs ----------

class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str


class ProductOut(BaseModel):
    id: str
    sku: str
    name: str
    description: str
    price_cents: int
    currency: str
    image_url: str
    stock: int
    category: Optional[CategoryOut] = None
    rating_avg: float = 0.0
    rating_count: int = 0


class ProductListOut(BaseModel):
    items: list[ProductOut]
    total: int


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


class StockChangeIn(BaseModel):
    items: list[dict]  # [{product_id, qty}, ...]


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str = Field(default="", max_length=140)
    body: str = Field(default="", max_length=4000)


class ReviewOut(BaseModel):
    id: str
    product_id: str
    user_id: str
    user_email: str
    rating: int
    title: str
    body: str
    created_at: str


# ---------- helpers ----------

def _to_out(p: db.Product, rating_avg: float, rating_count: int) -> ProductOut:
    return ProductOut(
        id=p.id, sku=p.sku, name=p.name, description=p.description,
        price_cents=p.price_cents, currency=p.currency, image_url=p.image_url,
        stock=p.stock,
        category=CategoryOut(id=p.category.id, name=p.category.name,
                             slug=p.category.slug) if p.category else None,
        rating_avg=round(rating_avg, 2), rating_count=rating_count,
    )


def _rating_aggregate(s, product_ids: list[str]) -> dict[str, tuple[float, int]]:
    if not product_ids:
        return {}
    rows = (
        s.query(db.Review.product_id,
                func.avg(db.Review.rating),
                func.count(db.Review.id))
         .filter(db.Review.product_id.in_(product_ids))
         .group_by(db.Review.product_id)
         .all()
    )
    return {pid: (float(avg or 0), int(count)) for pid, avg, count in rows}


# ---------- public read routes ----------

@app.get("/catalog/products", response_model=ProductListOut)
def list_products(
    q: Optional[str] = Query(default=None, description="search term"),
    category: Optional[str] = Query(default=None, description="category slug"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ProductListOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        query = s.query(db.Product)
        if q:
            like = f"%{q.lower()}%"
            query = query.filter(or_(
                db.Product.name.ilike(like),
                db.Product.description.ilike(like),
                db.Product.sku.ilike(like),
            ))
        if category:
            query = query.join(db.Category).filter(db.Category.slug == category)
        total = query.count()
        rows = query.order_by(db.Product.created_at.desc()) \
                .offset(offset).limit(limit).all()
        ratings = _rating_aggregate(s, [p.id for p in rows])
        items = [_to_out(p, *ratings.get(p.id, (0.0, 0))) for p in rows]
        return ProductListOut(items=items, total=total)


@app.get("/catalog/products/{product_id}", response_model=ProductOut)
def get_product(product_id: str) -> ProductOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        p = s.get(db.Product, product_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
        ratings = _rating_aggregate(s, [p.id])
        return _to_out(p, *ratings.get(p.id, (0.0, 0)))


@app.get("/catalog/categories", response_model=list[CategoryOut])
def list_categories() -> list[CategoryOut]:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        rows = s.query(db.Category).order_by(db.Category.name).all()
        return [CategoryOut(id=c.id, name=c.name, slug=c.slug) for c in rows]


# ---------- reviews ----------

def _review_to_out(r: db.Review) -> ReviewOut:
    return ReviewOut(
        id=r.id, product_id=r.product_id, user_id=r.user_id,
        user_email=r.user_email, rating=r.rating, title=r.title, body=r.body,
        created_at=r.created_at.isoformat(),
    )


@app.get("/catalog/products/{product_id}/reviews", response_model=list[ReviewOut])
def list_reviews(product_id: str) -> list[ReviewOut]:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        if not s.get(db.Product, product_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
        rows = s.query(db.Review).filter_by(product_id=product_id) \
                .order_by(db.Review.created_at.desc()).all()
        return [_review_to_out(r) for r in rows]


@app.post("/catalog/products/{product_id}/reviews",
          response_model=ReviewOut, status_code=201)
def create_review(product_id: str, payload: ReviewIn,
                  claims: TokenClaims = Depends(require_customer)) -> ReviewOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        if not s.get(db.Product, product_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
        existing = s.query(db.Review).filter_by(
            product_id=product_id, user_id=claims.sub,
        ).one_or_none()
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "you have already reviewed this product")
        r = db.Review(
            product_id=product_id, user_id=claims.sub,
            user_email=claims.email, rating=payload.rating,
            title=payload.title, body=payload.body,
        )
        s.add(r)
        s.commit()
        s.refresh(r)
        return _review_to_out(r)


@app.delete("/catalog/products/{product_id}/reviews/{review_id}", status_code=204, response_model=None)
def delete_review(product_id: str, review_id: str,
                  claims: TokenClaims = Depends(require_customer)) -> None:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        r = s.get(db.Review, review_id)
        if not r or r.product_id != product_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "review not found")
        if r.user_id != claims.sub:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not your review")
        s.delete(r)
        s.commit()


# ---------- internal write routes ----------

@app.post("/catalog/internal/products", response_model=ProductOut,
          dependencies=[Depends(require_internal_key)], status_code=201)
def create_product(payload: ProductCreateIn) -> ProductOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        if s.query(db.Product).filter_by(sku=payload.sku).one_or_none():
            raise HTTPException(status.HTTP_409_CONFLICT, "sku already exists")
        category_id: Optional[str] = None
        if payload.category_slug:
            cat = s.query(db.Category).filter_by(slug=payload.category_slug).one_or_none()
            if not cat:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "unknown category")
            category_id = cat.id
        p = db.Product(
            sku=payload.sku, name=payload.name, description=payload.description,
            price_cents=payload.price_cents, currency=payload.currency,
            image_url=payload.image_url, stock=payload.stock, category_id=category_id,
        )
        s.add(p)
        s.commit()
        s.refresh(p)
        return _to_out(p, 0.0, 0)


@app.patch("/catalog/internal/products/{product_id}", response_model=ProductOut,
           dependencies=[Depends(require_internal_key)])
def update_product(product_id: str, payload: ProductUpdateIn) -> ProductOut:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        p = s.get(db.Product, product_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
        for field in ("name", "description", "price_cents", "image_url", "stock"):
            v = getattr(payload, field)
            if v is not None:
                setattr(p, field, v)
        if payload.category_slug is not None:
            cat = s.query(db.Category).filter_by(slug=payload.category_slug).one_or_none()
            if not cat:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "unknown category")
            p.category_id = cat.id
        s.commit()
        s.refresh(p)
        ratings = _rating_aggregate(s, [p.id])
        return _to_out(p, *ratings.get(p.id, (0.0, 0)))


@app.delete("/catalog/internal/products/{product_id}",
            status_code=204, response_model=None, dependencies=[Depends(require_internal_key)])
def delete_product(product_id: str) -> None:
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        p = s.get(db.Product, product_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
        s.delete(p)
        s.commit()


@app.post("/catalog/internal/stock/decrement",
          dependencies=[Depends(require_internal_key)])
def decrement_stock(payload: StockChangeIn) -> dict:
    """Atomically decrement stock for a list of items; all-or-nothing."""
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        ids = [it["product_id"] for it in payload.items]
        rows = (
            s.query(db.Product)
             .options(lazyload(db.Product.category))
             .filter(db.Product.id.in_(ids))
             .with_for_update()
             .all()
        )
        by_id = {r.id: r for r in rows}
        for it in payload.items:
            p = by_id.get(it["product_id"])
            if not p:
                raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                    f"unknown product {it['product_id']}")
            if p.stock < it["qty"]:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"insufficient stock for {p.sku}: have {p.stock}, need {it['qty']}",
                )
        for it in payload.items:
            by_id[it["product_id"]].stock -= it["qty"]
        s.commit()
        return {"ok": True}


@app.post("/catalog/internal/stock/restock",
          dependencies=[Depends(require_internal_key)])
def restock(payload: StockChangeIn) -> dict:
    """Increment stock for a list of items. Used by the refund flow.

    No upper bound: a refund undoes whatever was decremented.
    """
    assert db.SessionFactory is not None
    with transactional(db.SessionFactory) as s:
        ids = [it["product_id"] for it in payload.items]
        rows = (
            s.query(db.Product)
             .options(lazyload(db.Product.category))
             .filter(db.Product.id.in_(ids))
             .with_for_update()
             .all()
        )
        by_id = {r.id: r for r in rows}
        for it in payload.items:
            p = by_id.get(it["product_id"])
            if not p:
                # Product was deleted since the order was placed —
                # silently skip rather than failing the refund.
                log.warning("restock skipped, product gone",
                            extra={"product_id": it["product_id"]})
                continue
            p.stock += it["qty"]
        s.commit()
        return {"ok": True}


# ---------- health ----------

@app.get("/health")
@app.get("/healthz")
@app.get("/readyz")
def health() -> dict:
    return {"status": "ok", "service": "catalog"}
