"""Live integration tests.

Run against a running docker-compose stack:
    docker compose --profile test run --rm tests

Unlike the in-process pytest suite (test_auth.py, test_catalog.py, etc.)
this hits the services over the network, exercising the same code paths
a real client would. We use real registration/login here — no demo
tokens — so this also validates the auth service end-to-end.
"""

import os
import time
import uuid

import pytest
import requests


CATALOG = os.environ["CATALOG_API_URL"]
CART = os.environ["CART_API_URL"]
CHECKOUT = os.environ["CHECKOUT_API_URL"]
AUTH = os.environ["AUTH_API_URL"]
ADMIN = os.environ["ADMIN_API_URL"]
INTERNAL = {"X-Internal-Key": os.environ["INTERNAL_API_KEY"]}


# Each test run gets a unique customer so the stack can be re-tested
# without restarting (registrations would 409 on duplicate emails).
# We combine timestamp + full UUID to make collision essentially impossible
# even if the stack runs back-to-back tests on the same database.
SUFFIX = f"{int(time.time() * 1000)}-{uuid.uuid4().hex}"
CUSTOMER_EMAIL = f"customer-{SUFFIX}@example.com"
CUSTOMER_PASSWORD = "test-password-1234"


@pytest.fixture(scope="session")
def customer_token() -> str:
    r = requests.post(
        f"{AUTH}/auth/customer/register",
        json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD,
              "full_name": "Integration Tester"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token() -> str:
    r = requests.post(
        f"{AUTH}/auth/admin/login",
        json={"email": "admin@shopcloud.example", "password": "admin12345"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ----------------------------------------------------------------------
# Health
# ----------------------------------------------------------------------

def test_all_services_healthy():
    for url in [CATALOG, CART, CHECKOUT, AUTH, ADMIN]:
        r = requests.get(f"{url}/healthz", timeout=5)
        assert r.status_code == 200, f"{url} unhealthy: {r.text}"


# ----------------------------------------------------------------------
# Auth
# ----------------------------------------------------------------------

def test_duplicate_registration_rejected():
    """We registered CUSTOMER_EMAIL via the fixture; second attempt 409s."""
    r = requests.post(
        f"{AUTH}/auth/customer/register",
        json={"email": CUSTOMER_EMAIL, "password": "anything-1234"},
        timeout=10,
    )
    assert r.status_code == 409


def test_wrong_password_rejected():
    r = requests.post(
        f"{AUTH}/auth/customer/login",
        json={"email": CUSTOMER_EMAIL, "password": "definitely-wrong"},
        timeout=10,
    )
    assert r.status_code == 401


def test_profile_round_trip(customer_token):
    r = requests.get(f"{AUTH}/auth/me", headers=bearer(customer_token), timeout=5)
    assert r.status_code == 200
    assert r.json()["email"] == CUSTOMER_EMAIL


def test_admin_token_cannot_read_customer_profile(admin_token):
    """JWT pool enforcement — an admin token should 403 on customer-only routes."""
    r = requests.get(f"{AUTH}/auth/me", headers=bearer(admin_token), timeout=5)
    assert r.status_code == 403


# ----------------------------------------------------------------------
# Catalog
# ----------------------------------------------------------------------

def test_catalog_seed_loaded():
    r = requests.get(f"{CATALOG}/catalog/products", timeout=5)
    assert r.status_code == 200
    assert r.json()["total"] >= 1


def test_catalog_internal_requires_key():
    r = requests.post(
        f"{CATALOG}/catalog/internal/products",
        json={"sku": "X", "name": "X", "price_cents": 100},
        timeout=5,
    )
    assert r.status_code == 403


# ----------------------------------------------------------------------
# Cart + checkout (the cross-service flow that's hardest to test)
# ----------------------------------------------------------------------

def test_full_purchase_flow(customer_token, admin_token):
    products = requests.get(f"{CATALOG}/catalog/products", timeout=5).json()["items"]
    assert products, "catalog seed should have loaded"
    product = products[0]
    pid = product["id"]
    starting_stock = product["stock"]

    # Add to cart
    r = requests.post(
        f"{CART}/cart/items",
        headers=bearer(customer_token),
        json={"product_id": pid, "qty": 1},
        timeout=5,
    )
    assert r.status_code == 200, r.text

    # Verify cart now has it
    cart = requests.get(f"{CART}/cart", headers=bearer(customer_token), timeout=5).json()
    assert any(line["product_id"] == pid for line in cart["items"])

    # Checkout
    r = requests.post(
        f"{CHECKOUT}/checkout",
        headers=bearer(customer_token),
        json={},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    order = r.json()
    order_id = order["id"]
    assert order["status"] == "confirmed"

    # Stock was decremented
    p = requests.get(f"{CATALOG}/catalog/products/{pid}", timeout=5).json()
    assert p["stock"] == starting_stock - 1, "checkout should have decremented stock"

    # Cart is now empty
    cart = requests.get(f"{CART}/cart", headers=bearer(customer_token), timeout=5).json()
    assert cart["items"] == []

    # Order shows up in customer's history
    orders = requests.get(
        f"{CHECKOUT}/checkout/orders",
        headers=bearer(customer_token),
        timeout=5,
    ).json()
    assert any(o["id"] == order_id for o in orders)

    # Admin can see the order via the admin service
    admin_orders = requests.get(
        f"{ADMIN}/admin/orders",
        headers=bearer(admin_token),
        timeout=5,
    ).json()
    assert any(o["id"] == order_id for o in admin_orders)


def test_admin_refund_restocks(customer_token, admin_token):
    """The bug we fixed: refunds must restock items."""
    products = requests.get(f"{CATALOG}/catalog/products", timeout=5).json()["items"]
    pid = products[0]["id"]

    # Place an order first
    requests.post(
        f"{CART}/cart/items",
        headers=bearer(customer_token),
        json={"product_id": pid, "qty": 1},
        timeout=5,
    )
    order_id = requests.post(
        f"{CHECKOUT}/checkout", headers=bearer(customer_token),
        json={}, timeout=10,
    ).json()["id"]

    stock_after_order = requests.get(
        f"{CATALOG}/catalog/products/{pid}", timeout=5,
    ).json()["stock"]

    # Refund it
    r = requests.post(
        f"{ADMIN}/admin/orders/{order_id}/refund",
        headers=bearer(admin_token),
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "refunded"

    # Stock restored
    stock_after_refund = requests.get(
        f"{CATALOG}/catalog/products/{pid}", timeout=5,
    ).json()["stock"]
    assert stock_after_refund == stock_after_order + 1


# ----------------------------------------------------------------------
# Catalog admin product creation through the admin service
# ----------------------------------------------------------------------

def test_admin_can_create_product(admin_token):
    sku = f"INT-TEST-{SUFFIX}"
    r = requests.post(
        f"{ADMIN}/admin/products",
        headers=bearer(admin_token),
        json={
            "sku": sku, "name": "Integration Test Product",
            "description": "Created by integration tests",
            "price_cents": 1999, "stock": 10,
            "category_slug": "home",
        },
        timeout=10,
    )
    assert r.status_code == 201, r.text
    new_id = r.json()["id"]

    # Verify it appears in the public catalog
    r = requests.get(f"{CATALOG}/catalog/products/{new_id}", timeout=5)
    assert r.status_code == 200
    assert r.json()["sku"] == sku

    # Clean up
    requests.delete(
        f"{ADMIN}/admin/products/{new_id}",
        headers=bearer(admin_token),
        timeout=5,
    )
