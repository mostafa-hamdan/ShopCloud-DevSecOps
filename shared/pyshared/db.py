"""Common DB helpers. Each service still owns its own engine + Base, but
the patterns are identical so we centralize them here."""

from __future__ import annotations

import contextlib
import os
from typing import Iterator, Optional

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


def make_engine(url: Optional[str] = None) -> Engine:
    """Build an engine from DATABASE_URL with sensible defaults."""
    return create_engine(
        url or os.environ["DATABASE_URL"],
        pool_pre_ping=True,           # detect dead connections (e.g. RDS failover)
        pool_recycle=1800,            # rotate connections every 30 min
        future=True,
    )


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@contextlib.contextmanager
def transactional(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    """Open a Session, roll back on exception, always close.

    Replaces the old pattern of ``with session_scope() as s:`` which only
    closed on exit and could leak in-progress transactions back to the
    pool when a handler raised.
    """
    s = session_factory()
    try:
        yield s
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()
