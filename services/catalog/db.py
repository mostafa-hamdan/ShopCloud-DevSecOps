"""Catalog DB. Products, categories, and product reviews.

Reviews live here (not in a separate service) because they're
read-heavy and always rendered alongside the product. Splitting them
would force a fan-out call on every product page render.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime, ForeignKey, Index, Integer, String, Text,
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker,
)

from pyshared.db import make_engine, make_session_factory


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    sku: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    category_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("categories.id"), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow,
    )

    category: Mapped[Category | None] = relationship(lazy="joined")
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", lazy="selectin",
    )

    __table_args__ = (
        Index("ix_products_name", "name"),
    )


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    user_email: Mapped[str] = mapped_column(String(255), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1–5
    title: Mapped[str] = mapped_column(String(140), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped[Product] = relationship(back_populates="reviews")

    __table_args__ = (
        # one review per (product, user) — checked at app level too
        Index("ix_reviews_product_user", "product_id", "user_id", unique=True),
    )


SessionFactory: sessionmaker[Session] | None = None


def init_engine() -> sessionmaker[Session]:
    global SessionFactory
    engine = make_engine()
    SessionFactory = make_session_factory(engine)
    Base.metadata.create_all(engine)
    _seed_if_empty()
    return SessionFactory


def _seed_if_empty() -> None:
    assert SessionFactory is not None
    with SessionFactory() as s:
        if s.query(Product).count() > 0:
            return

        cats = {
            "apparel": Category(name="Apparel", slug="apparel"),
            "electronics": Category(name="Electronics", slug="electronics"),
            "home": Category(name="Home", slug="home"),
        }
        s.add_all(cats.values())
        s.flush()

        seed = [
            ("SKU-T01", "Cotton T-Shirt", "Soft cotton, classic fit.", 1999, "apparel", 50, "/products/cotton-tshirt.jpg"),
            ("SKU-J02", "Denim Jacket", "Mid-weight denim jacket.", 7999, "apparel", 18, "/products/denim-jacket.jpg"),
            ("SKU-H01", "Wireless Headphones", "Over-ear, 30h battery.", 12999, "electronics", 25, "/products/wireless-headphones.jpg"),
            ("SKU-K01", "Mechanical Keyboard", "Tactile switches, USB-C.", 8999, "electronics", 12, "/products/mechanical-keyboard.jpg"),
            ("SKU-M02", "Ceramic Mug", "12oz, dishwasher safe.", 1499, "home", 100, "/products/ceramic-mug.jpg"),
            ("SKU-L03", "Desk Lamp", "Adjustable warm/cool.", 4499, "home", 30, "/products/desk-lamp.jpg"),
        ]
        for sku, name, desc, price, cat, stock, image_url in seed:
            s.add(Product(
                sku=sku, name=name, description=desc,
                price_cents=price, category_id=cats[cat].id, stock=stock,
                image_url=image_url,
            ))
        s.commit()
