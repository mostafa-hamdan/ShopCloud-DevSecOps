import os
import uuid

import requests

CATALOG = os.environ["CATALOG_API_URL"]
CART = os.environ["CART_API_URL"]
CHECKOUT = os.environ["CHECKOUT_API_URL"]
AUTH = os.environ["AUTH_API_URL"]
ADMIN = os.environ["ADMIN_API_URL"]
CUSTOMER_HEADERS = {"Authorization": f"Bearer {os.environ['CUSTOMER_DEMO_TOKEN']}"}
ADMIN_HEADERS = {"Authorization": f"Bearer {os.environ['ADMIN_DEMO_TOKEN']}"}


def clear_cart():
    response = requests.get(f"{CART}/cart", headers=CUSTOMER_HEADERS, timeout=5)
    response.raise_for_status()
    for item in response.json().get("items", []):
        requests.delete(f"{CART}/cart/items/{item['product_id']}", headers=CUSTOMER_HEADERS, timeout=5).raise_for_status()


def test_health_endpoints():
    services = [
        f"{CATALOG}/healthz",
        f"{CART}/healthz",
        f"{CHECKOUT}/healthz",
        f"{AUTH}/healthz",
        f"{ADMIN}/healthz",
    ]
    for url in services:
        response = requests.get(url, timeout=5)
        assert response.status_code == 200
        assert response.json()["status"] in {"ok", "ready"}


def test_catalog_list():
    response = requests.get(f"{CATALOG}/products", timeout=5)
    response.raise_for_status()
    payload = response.json()
    assert payload["items"]
    assert any("name" in item for item in payload["items"])


def test_cart_add_and_view():
    clear_cart()
    response = requests.post(
        f"{CART}/cart/items",
        json={"product_id": 1, "quantity": 2},
        headers=CUSTOMER_HEADERS,
        timeout=5,
    )
    response.raise_for_status()

    cart_response = requests.get(f"{CART}/cart", headers=CUSTOMER_HEADERS, timeout=5)
    cart_response.raise_for_status()
    items = cart_response.json()["items"]
    assert any(item["product_id"] == 1 and item["quantity"] >= 2 for item in items)


def test_checkout_creates_order():
    clear_cart()
    requests.post(
        f"{CART}/cart/items",
        json={"product_id": 2, "quantity": 1},
        headers=CUSTOMER_HEADERS,
        timeout=5,
    ).raise_for_status()

    checkout_response = requests.post(
        f"{CHECKOUT}/checkout",
        json={"customer_email": "customer@example.com"},
        headers=CUSTOMER_HEADERS,
        timeout=10,
    )
    checkout_response.raise_for_status()
    order_id = checkout_response.json()["order_id"]

    orders_response = requests.get(f"{ADMIN}/admin/orders", headers=ADMIN_HEADERS, timeout=5)
    orders_response.raise_for_status()
    orders = orders_response.json()["items"]
    assert any(order["id"] == order_id for order in orders)


def test_admin_product_creation():
    unique_name = f"Test Product {uuid.uuid4().hex[:8]}"
    response = requests.post(
        f"{ADMIN}/admin/products",
        json={
            "name": unique_name,
            "category": "office",
            "description": "Created by integration test",
            "price": 19.99,
            "stock": 5,
            "image_url": "https://placehold.co/600x400?text=Test+Product",
        },
        headers=ADMIN_HEADERS,
        timeout=5,
    )
    response.raise_for_status()
    assert response.json()["product_id"] > 0