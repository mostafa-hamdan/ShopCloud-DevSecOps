-- Tables for ShopCloud are created at app startup via SQLAlchemy
-- `Base.metadata.create_all(engine)` in each service's lifespan handler.
-- See services/auth/db.py, services/catalog/db.py, services/checkout/db.py.
--
-- This file exists only to confirm the database is reachable; it intentionally
-- does no schema work. In production we'd switch to Alembic migrations and
-- remove the create_all calls.
SELECT 'shopcloud database initialized' AS status;
