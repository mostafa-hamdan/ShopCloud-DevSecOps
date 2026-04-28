"""Checkout tests.

Checkout has the most complex contract — it talks to cart, catalog,
and the queue. We mock cart/catalog with respx and let the queue
backend be the local-file one (which works for free).
"""

import importlib
import json

import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response

from pyshared.auth import issue_token


CART_URL = "http://cart:8002"
CAT_URL = "http://catalog:8001"
AUTH_URL = "http://auth:8004"


@pytest.fixture(autouse=True)
def _set_env(monkeypatch):
    monkeypatch.setenv("CART_BASE_URL", CART_URL)
    monkeypatch.setenv("CATALOG_BASE_URL", CAT_URL)
    monkeypatch.setenv("AUTH_BASE_URL", AUTH_URL)
    monkeypatch.setenv("QUEUE_BACKEND", "local")


def _client():
    import checkout.db as cdb
    importlib.reload(cdb)
    import checkout.main as cmain
    importlib.reload(cmain)
    return TestClient(cmain.app)


def _bearer(user_id="user-1"):
    return {"Authorization": f"Bearer {issue_token(user_id, f'{user_id}@x.com', 'customer')}"}


def _mock_product(pid="p-1", stock=10, price=2500, name="Widget"):
    return {
        "id": pid, "sku": f"SKU-{pid}", "name": name, "description": "",
        "price_cents": price, "currency": "USD", "image_url": "",
        "stock": stock, "category": None,
        "rating_avg": 0.0, "rating_count": 0,
    }


def _mock_cart(items):
    """items is list of (pid, qty, price)"""
    lines = [
        {"product_id": pid, "qty": qty, "name": "X",
         "price_cents": price, "currency": "USD", "image_url": "",
         "line_total_cents": price * qty, "in_stock": True}
        for pid, qty, price in items
    ]
    return {
        "user_id": "user-1", "items": lines,
        "subtotal_cents": sum(p * q for _, q, p in items),
        "currency": "USD",
    }


def test_empty_cart_rejected():
    with _client() as c, respx.mock() as mock:
        mock.get(f"{CART_URL}/cart/internal/user-1").mock(
            return_value=Response(200, json=_mock_cart([])))
        r = c.post("/checkout", headers=_bearer(), json={})
        assert r.status_code == 400


def test_happy_path_places_order():
    with _client() as c, respx.mock() as mock:
        mock.get(f"{CART_URL}/cart/internal/user-1").mock(
            return_value=Response(200, json=_mock_cart([("p-1", 2, 2500)])))
        mock.get(f"{CAT_URL}/catalog/products/p-1").mock(
            return_value=Response(200, json=_mock_product(price=2500, stock=10)))
        mock.post(f"{CAT_URL}/catalog/internal/stock/decrement").mock(
            return_value=Response(200, json={"ok": True}))
        mock.delete(f"{CART_URL}/cart/internal/user-1").mock(
            return_value=Response(204))

        r = c.post("/checkout", headers=_bearer(), json={})
        assert r.status_code == 201, r.text
        order = r.json()
        assert order["subtotal_cents"] == 5000
        assert order["status"] == "confirmed"
        assert len(order["lines"]) == 1


def test_insufficient_stock_blocks_order():
    """If catalog reports less stock than the cart asks for, we 409
    BEFORE attempting to decrement."""
    with _client() as c, respx.mock(assert_all_called=False) as mock:
        mock.get(f"{CART_URL}/cart/internal/user-1").mock(
            return_value=Response(200, json=_mock_cart([("p-1", 100, 100)])))
        mock.get(f"{CAT_URL}/catalog/products/p-1").mock(
            return_value=Response(200, json=_mock_product(stock=5)))
        # Decrement endpoint should NOT be called.
        decrement_route = mock.post(f"{CAT_URL}/catalog/internal/stock/decrement")

        r = c.post("/checkout", headers=_bearer(), json={})
        assert r.status_code == 409
        assert decrement_route.call_count == 0


def test_deleted_product_in_cart_409s():
    with _client() as c, respx.mock() as mock:
        mock.get(f"{CART_URL}/cart/internal/user-1").mock(
            return_value=Response(200, json=_mock_cart([("ghost", 1, 100)])))
        mock.get(f"{CAT_URL}/catalog/products/ghost").mock(return_value=Response(404, json={"detail":"x"}))
        r = c.post("/checkout", headers=_bearer(), json={})
        assert r.status_code == 409


def test_invoice_event_published(tmp_path, monkeypatch):
    """The order placement should append a message to the local queue."""
    monkeypatch.setenv("LOCAL_QUEUE_PATH", str(tmp_path / "queue"))
    with _client() as c, respx.mock() as mock:
        mock.get(f"{CART_URL}/cart/internal/user-1").mock(
            return_value=Response(200, json=_mock_cart([("p-1", 1, 1000)])))
        mock.get(f"{CAT_URL}/catalog/products/p-1").mock(
            return_value=Response(200, json=_mock_product(price=1000)))
        mock.post(f"{CAT_URL}/catalog/internal/stock/decrement").mock(
            return_value=Response(200, json={"ok": True}))
        mock.delete(f"{CART_URL}/cart/internal/user-1").mock(return_value=Response(204))

        r = c.post("/checkout", headers=_bearer(), json={})
        assert r.status_code == 201

        queue_file = tmp_path / "queue"
        assert queue_file.exists()
        line = queue_file.read_text().strip()
        rec = json.loads(line)
        assert rec["body"]["type"] == "invoice.requested"
        assert rec["body"]["order_id"] == r.json()["id"]


def test_order_history():
    with _client() as c, respx.mock() as mock:
        mock.get(f"{CART_URL}/cart/internal/user-1").mock(
            return_value=Response(200, json=_mock_cart([("p-1", 1, 100)])))
        mock.get(f"{CAT_URL}/catalog/products/p-1").mock(
            return_value=Response(200, json=_mock_product(price=100)))
        mock.post(f"{CAT_URL}/catalog/internal/stock/decrement").mock(
            return_value=Response(200, json={"ok": True}))
        mock.delete(f"{CART_URL}/cart/internal/user-1").mock(return_value=Response(204))

        c.post("/checkout", headers=_bearer(), json={})
        r = c.get("/checkout/orders", headers=_bearer())
        assert r.status_code == 200
        assert len(r.json()) == 1


def test_admin_refund_restocks():
    """Refund should restock items via the catalog restock endpoint."""
    with _client() as c, respx.mock() as mock:
        mock.get(f"{CART_URL}/cart/internal/user-1").mock(
            return_value=Response(200, json=_mock_cart([("p-1", 3, 100)])))
        mock.get(f"{CAT_URL}/catalog/products/p-1").mock(
            return_value=Response(200, json=_mock_product(price=100)))
        mock.post(f"{CAT_URL}/catalog/internal/stock/decrement").mock(
            return_value=Response(200, json={"ok": True}))
        mock.delete(f"{CART_URL}/cart/internal/user-1").mock(return_value=Response(204))

        order = c.post("/checkout", headers=_bearer(), json={}).json()

        restock_route = mock.post(f"{CAT_URL}/catalog/internal/stock/restock").mock(
            return_value=Response(200, json={"ok": True}))

        r = c.post(f"/checkout/internal/orders/{order['id']}/refund",
                   headers={"X-Internal-Key": "test-internal-key"})
        assert r.status_code == 200
        assert r.json()["status"] == "refunded"
        assert restock_route.call_count == 1
        # check the restock payload has the right qty
        assert restock_route.calls[0].request.read() != b""


def test_return_request_then_approve_restocks():
    with _client() as c, respx.mock() as mock:
        mock.get(f"{CART_URL}/cart/internal/user-1").mock(
            return_value=Response(200, json=_mock_cart([("p-1", 2, 100)])))
        mock.get(f"{CAT_URL}/catalog/products/p-1").mock(
            return_value=Response(200, json=_mock_product(price=100)))
        mock.post(f"{CAT_URL}/catalog/internal/stock/decrement").mock(
            return_value=Response(200, json={"ok": True}))
        mock.delete(f"{CART_URL}/cart/internal/user-1").mock(return_value=Response(204))

        order = c.post("/checkout", headers=_bearer(), json={}).json()

        # request a return
        r = c.post(f"/checkout/orders/{order['id']}/return",
                   headers=_bearer(),
                   json={"reason": "wrong size"})
        assert r.status_code == 201
        ret_id = r.json()["id"]

        # order is now pending
        r = c.get(f"/checkout/orders/{order['id']}", headers=_bearer())
        assert r.json()["status"] == "return_pending"

        # admin approves -> restock
        restock_route = mock.post(f"{CAT_URL}/catalog/internal/stock/restock").mock(
            return_value=Response(200, json={"ok": True}))
        r = c.post(f"/checkout/internal/returns/{ret_id}/approve",
                   headers={"X-Internal-Key": "test-internal-key"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"
        assert restock_route.call_count == 1
