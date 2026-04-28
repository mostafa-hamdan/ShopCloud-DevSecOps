"""Catalog tests.

Cover: seed data, search, category filter, internal CRUD authorization,
atomic stock decrement (the key invariant), restock, reviews with
duplicate prevention and rating aggregation.
"""

import importlib

from fastapi.testclient import TestClient

from pyshared.auth import issue_token


INTERNAL = {"X-Internal-Key": "test-internal-key"}


def _client():
    import catalog.db as cdb
    importlib.reload(cdb)
    import catalog.main as cmain
    importlib.reload(cmain)
    return TestClient(cmain.app)


def _bearer(user_id="user-1"):
    return {"Authorization": f"Bearer {issue_token(user_id, f'{user_id}@x.com', 'customer')}"}


def test_seed_data_loaded():
    with _client() as c:
        r = c.get("/catalog/products")
        assert r.status_code == 200
        assert r.json()["total"] == 6


def test_search():
    with _client() as c:
        r = c.get("/catalog/products?q=mug")
        assert r.status_code == 200
        names = [p["name"] for p in r.json()["items"]]
        assert any("Mug" in n for n in names)


def test_category_filter():
    with _client() as c:
        r = c.get("/catalog/products?category=apparel")
        items = r.json()["items"]
        assert len(items) > 0
        assert all(p["category"]["slug"] == "apparel" for p in items)


def test_unknown_product_404():
    with _client() as c:
        assert c.get("/catalog/products/nope").status_code == 404


def test_internal_create_requires_key():
    with _client() as c:
        r = c.post("/catalog/internal/products",
                   json={"sku": "X", "name": "X", "price_cents": 100})
        assert r.status_code == 403


def test_internal_create_succeeds_with_key():
    with _client() as c:
        r = c.post("/catalog/internal/products", headers=INTERNAL, json={
            "sku": "TEST-1", "name": "Test", "price_cents": 500, "stock": 10,
        })
        assert r.status_code == 201
        assert r.json()["sku"] == "TEST-1"


def test_duplicate_sku_rejected():
    with _client() as c:
        c.post("/catalog/internal/products", headers=INTERNAL,
               json={"sku": "DUP", "name": "X", "price_cents": 100})
        r = c.post("/catalog/internal/products", headers=INTERNAL,
                   json={"sku": "DUP", "name": "Y", "price_cents": 200})
        assert r.status_code == 409


def test_stock_decrement_atomic():
    """The critical invariant: an over-decrement must not partially
    apply. If any item fails the check, the whole batch rolls back."""
    with _client() as c:
        # Two products: one with 10 stock, one with only 1.
        a = c.post("/catalog/internal/products", headers=INTERNAL, json={
            "sku": "A", "name": "A", "price_cents": 100, "stock": 10,
        }).json()
        b = c.post("/catalog/internal/products", headers=INTERNAL, json={
            "sku": "B", "name": "B", "price_cents": 100, "stock": 1,
        }).json()

        # Try to decrement A by 5 (would succeed) AND B by 5 (would fail).
        # The whole call must reject and BOTH stocks must be unchanged.
        r = c.post("/catalog/internal/stock/decrement", headers=INTERNAL, json={
            "items": [{"product_id": a["id"], "qty": 5},
                      {"product_id": b["id"], "qty": 5}],
        })
        assert r.status_code == 409
        assert c.get(f"/catalog/products/{a['id']}").json()["stock"] == 10
        assert c.get(f"/catalog/products/{b['id']}").json()["stock"] == 1


def test_restock():
    with _client() as c:
        p = c.post("/catalog/internal/products", headers=INTERNAL, json={
            "sku": "R", "name": "R", "price_cents": 100, "stock": 5,
        }).json()
        c.post("/catalog/internal/stock/restock", headers=INTERNAL, json={
            "items": [{"product_id": p["id"], "qty": 3}],
        })
        assert c.get(f"/catalog/products/{p['id']}").json()["stock"] == 8


def test_review_lifecycle():
    with _client() as c:
        pid = c.get("/catalog/products").json()["items"][0]["id"]

        # post
        r = c.post(f"/catalog/products/{pid}/reviews",
                   headers=_bearer("u1"),
                   json={"rating": 5, "title": "Great"})
        assert r.status_code == 201

        # duplicate by same user
        r = c.post(f"/catalog/products/{pid}/reviews",
                   headers=_bearer("u1"),
                   json={"rating": 4})
        assert r.status_code == 409

        # second user can review
        r = c.post(f"/catalog/products/{pid}/reviews",
                   headers=_bearer("u2"),
                   json={"rating": 3})
        assert r.status_code == 201

        # aggregation
        r = c.get(f"/catalog/products/{pid}")
        assert r.json()["rating_count"] == 2
        assert r.json()["rating_avg"] == 4.0


def test_review_rating_validation():
    with _client() as c:
        pid = c.get("/catalog/products").json()["items"][0]["id"]
        for bad in (0, 6, -1, 100):
            r = c.post(f"/catalog/products/{pid}/reviews",
                       headers=_bearer("u1"),
                       json={"rating": bad})
            assert r.status_code == 422
