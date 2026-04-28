"""Cart tests.

Cart needs Redis and a catalog upstream. We use fakeredis for Redis and
a respx mock for the catalog HTTP calls so the test stays in-process.
"""

import importlib

import fakeredis
import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response

from pyshared.auth import issue_token


CAT_URL = "http://catalog:8001"


@pytest.fixture(autouse=True)
def _set_cart_env(monkeypatch):
    monkeypatch.setenv("CATALOG_BASE_URL", CAT_URL)


def _client(monkeypatch):
    import cart.main as cmain
    importlib.reload(cmain)
    # swap in fakeredis BEFORE the lifespan ping
    fake = fakeredis.FakeStrictRedis(decode_responses=True)
    monkeypatch.setattr(cmain, "_redis", fake)
    monkeypatch.setattr(cmain, "get_redis", lambda: fake)
    return TestClient(cmain.app), fake


def _bearer(user_id="user-1"):
    return {"Authorization": f"Bearer {issue_token(user_id, f'{user_id}@x.com', 'customer')}"}


def _mock_product(pid="p-1", stock=10, price=2500, name="Widget"):
    return {
        "id": pid, "sku": f"SKU-{pid}", "name": name, "description": "",
        "price_cents": price, "currency": "USD", "image_url": "",
        "stock": stock, "category": None,
        "rating_avg": 0.0, "rating_count": 0,
    }


def test_empty_cart(monkeypatch):
    c, _ = _client(monkeypatch)
    with c:
        r = c.get("/cart", headers=_bearer())
        assert r.status_code == 200
        assert r.json()["items"] == []


def test_add_and_get_cart(monkeypatch):
    c, _ = _client(monkeypatch)
    with c, respx.mock(base_url=CAT_URL) as mock:
        mock.get("/catalog/products/p-1").mock(return_value=Response(200, json=_mock_product()))
        r = c.post("/cart/items", headers=_bearer(),
                   json={"product_id": "p-1", "qty": 2})
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 1
        assert items[0]["qty"] == 2
        assert items[0]["line_total_cents"] == 5000


def test_add_unknown_product_404(monkeypatch):
    c, _ = _client(monkeypatch)
    with c, respx.mock(base_url=CAT_URL) as mock:
        mock.get("/catalog/products/nope").mock(return_value=Response(404, json={"detail":"x"}))
        r = c.post("/cart/items", headers=_bearer(),
                   json={"product_id": "nope", "qty": 1})
        assert r.status_code == 404


def test_set_qty_to_explicit_value(monkeypatch):
    c, _ = _client(monkeypatch)
    with c, respx.mock(base_url=CAT_URL) as mock:
        mock.get("/catalog/products/p-1").mock(return_value=Response(200, json=_mock_product()))
        c.post("/cart/items", headers=_bearer(), json={"product_id": "p-1", "qty": 2})
        c.post("/cart/items", headers=_bearer(), json={"product_id": "p-1", "qty": 3})
        # cart should now have qty 5 from two adds
        assert c.get("/cart", headers=_bearer()).json()["items"][0]["qty"] == 5

        # explicit set replaces
        c.put("/cart/items/p-1", headers=_bearer(),
              json={"product_id": "p-1", "qty": 1})
        assert c.get("/cart", headers=_bearer()).json()["items"][0]["qty"] == 1


def test_remove_item(monkeypatch):
    c, _ = _client(monkeypatch)
    with c, respx.mock(base_url=CAT_URL) as mock:
        mock.get("/catalog/products/p-1").mock(return_value=Response(200, json=_mock_product()))
        c.post("/cart/items", headers=_bearer(), json={"product_id": "p-1", "qty": 2})
        c.delete("/cart/items/p-1", headers=_bearer())
        assert c.get("/cart", headers=_bearer()).json()["items"] == []


def test_in_stock_flag_when_qty_exceeds_stock(monkeypatch):
    c, _ = _client(monkeypatch)
    with c, respx.mock(base_url=CAT_URL) as mock:
        # only 5 in stock
        mock.get("/catalog/products/p-1").mock(return_value=Response(200, json=_mock_product(stock=5)))
        c.post("/cart/items", headers=_bearer(), json={"product_id": "p-1", "qty": 10})
        items = c.get("/cart", headers=_bearer()).json()["items"]
        assert items[0]["in_stock"] is False


def test_internal_endpoints_require_key(monkeypatch):
    c, _ = _client(monkeypatch)
    with c:
        assert c.get("/cart/internal/user-1").status_code == 403
        assert c.get("/cart/internal/user-1",
                     headers={"X-Internal-Key": "test-internal-key"}).status_code == 200


def test_wishlist(monkeypatch):
    c, _ = _client(monkeypatch)
    with c, respx.mock(base_url=CAT_URL) as mock:
        mock.get("/catalog/products/p-1").mock(return_value=Response(200, json=_mock_product()))
        r = c.post("/wishlist/items", headers=_bearer(),
                   json={"product_id": "p-1"})
        assert r.status_code == 201
        assert len(r.json()["items"]) == 1

        # duplicate add is idempotent (set semantics)
        c.post("/wishlist/items", headers=_bearer(), json={"product_id": "p-1"})
        assert len(c.get("/wishlist", headers=_bearer()).json()["items"]) == 1

        c.delete("/wishlist/items/p-1", headers=_bearer())
        assert c.get("/wishlist", headers=_bearer()).json()["items"] == []
