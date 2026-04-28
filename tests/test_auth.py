"""Auth service tests.

Cover: registration, login, profile update, address book lifecycle
(including default-address invariants), internal customer listing
authorization.
"""

import importlib

from fastapi.testclient import TestClient


def _client():
    # Re-import so each test starts with a fresh module state. The DB URL
    # is rewritten by the conftest fixture before this is called.
    import auth.db as adb
    importlib.reload(adb)
    import auth.main as amain
    importlib.reload(amain)
    return TestClient(amain.app)


def _register_and_token(c, email="demo@example.com", password="pass1234"):
    r = c.post("/auth/customer/register",
               json={"email": email, "password": password, "full_name": "D"})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def test_health():
    with _client() as c:
        assert c.get("/health").status_code == 200


def test_register_and_login():
    with _client() as c:
        r = c.post("/auth/customer/register",
                   json={"email": "a@b.com", "password": "pass1234"})
        assert r.status_code == 201
        token = r.json()["access_token"]
        assert token

        r = c.post("/auth/customer/login",
                   json={"email": "a@b.com", "password": "pass1234"})
        assert r.status_code == 200


def test_register_duplicate_rejected():
    with _client() as c:
        c.post("/auth/customer/register",
               json={"email": "a@b.com", "password": "pass1234"})
        r = c.post("/auth/customer/register",
                   json={"email": "a@b.com", "password": "pass1234"})
        assert r.status_code == 409


def test_login_wrong_password_rejected():
    with _client() as c:
        c.post("/auth/customer/register",
               json={"email": "a@b.com", "password": "pass1234"})
        r = c.post("/auth/customer/login",
                   json={"email": "a@b.com", "password": "wrong"})
        assert r.status_code == 401


def test_short_password_rejected():
    with _client() as c:
        r = c.post("/auth/customer/register",
                   json={"email": "a@b.com", "password": "short"})
        assert r.status_code == 422


def test_profile_update():
    with _client() as c:
        token = _register_and_token(c)
        h = {"Authorization": f"Bearer {token}"}
        r = c.patch("/auth/me", headers=h, json={"full_name": "Updated"})
        assert r.status_code == 200
        assert r.json()["full_name"] == "Updated"


def test_first_address_is_default():
    with _client() as c:
        token = _register_and_token(c)
        h = {"Authorization": f"Bearer {token}"}
        r = c.post("/auth/me/addresses", headers=h, json={
            "full_name": "X", "line1": "1 Main", "city": "Beirut", "country": "LB",
        })
        assert r.status_code == 201
        assert r.json()["is_default"] is True


def test_default_swap():
    with _client() as c:
        token = _register_and_token(c)
        h = {"Authorization": f"Bearer {token}"}
        a1 = c.post("/auth/me/addresses", headers=h, json={
            "full_name": "X", "line1": "1 A", "city": "Beirut", "country": "LB",
        }).json()
        a2 = c.post("/auth/me/addresses", headers=h, json={
            "full_name": "X", "line1": "2 B", "city": "Beirut", "country": "LB",
            "is_default": True,
        }).json()
        # a1 should no longer be default
        addrs = {a["id"]: a for a in c.get("/auth/me/addresses", headers=h).json()}
        assert addrs[a1["id"]]["is_default"] is False
        assert addrs[a2["id"]]["is_default"] is True


def test_delete_default_promotes_next():
    with _client() as c:
        token = _register_and_token(c)
        h = {"Authorization": f"Bearer {token}"}
        a1 = c.post("/auth/me/addresses", headers=h, json={
            "full_name": "X", "line1": "1 A", "city": "Beirut", "country": "LB",
        }).json()
        a2 = c.post("/auth/me/addresses", headers=h, json={
            "full_name": "X", "line1": "2 B", "city": "Beirut", "country": "LB",
        }).json()
        # a1 is default. delete it. a2 should auto-promote.
        c.delete(f"/auth/me/addresses/{a1['id']}", headers=h)
        addrs = c.get("/auth/me/addresses", headers=h).json()
        assert len(addrs) == 1
        assert addrs[0]["id"] == a2["id"]
        assert addrs[0]["is_default"] is True


def test_internal_customer_list_requires_key():
    with _client() as c:
        _register_and_token(c)
        assert c.get("/auth/internal/customers").status_code == 403
        r = c.get("/auth/internal/customers",
                  headers={"X-Internal-Key": "test-internal-key"})
        assert r.status_code == 200
        assert r.json()["total"] == 1


def test_admin_token_cannot_use_customer_routes():
    """A token from the admin pool must not work on customer-only routes."""
    from pyshared.auth import issue_token
    with _client() as c:
        token = issue_token("admin-1", "admin@x.com", "admin")
        r = c.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403
