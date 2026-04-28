"""Checkout DB. Owns orders, order_lines, and returns."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker,
)

from pyshared.db import make_engine, make_session_factory


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


# Order statuses we use:
#   confirmed       — placed, payment simulated, stock decremented
#   refunded        — admin marked it as refunded; stock restocked
#   return_pending  — customer requested a return; awaiting admin action
#   returned        — admin approved the return; stock restocked, refund issued
class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    user_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="confirmed",
                                        index=True, nullable=False)
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Snapshot of the shipping address at time of order. Stored on the
    # order (not referenced) so that later edits/deletes to the address
    # book don't change history.
    ship_to: Mapped[str] = mapped_column(Text, default="")  # JSON

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow,
                                                 index=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow,
                                                 onupdate=datetime.utcnow)

    lines: Mapped[list["OrderLine"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin",
    )
    returns: Mapped[list["Return"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin",
    )


class OrderLine(Base):
    __tablename__ = "order_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"),
                                          index=True, nullable=False)
    product_id: Mapped[str] = mapped_column(String(36), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    order: Mapped[Order] = relationship(back_populates="lines")


# Return statuses:
#   requested  — customer asked for a return
#   approved   — admin approved; stock restocked
#   rejected   — admin denied
class Return(Base):
    __tablename__ = "returns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"),
                                          index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="requested",
                                        index=True, nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    order: Mapped[Order] = relationship(back_populates="returns")


SessionFactory: sessionmaker[Session] | None = None


def init_engine() -> sessionmaker[Session]:
    global SessionFactory
    engine = make_engine()
    SessionFactory = make_session_factory(engine)
    Base.metadata.create_all(engine)
    return SessionFactory
