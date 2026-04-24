import os

from fastapi import Depends

from shopcloud_common.api import create_app
from shopcloud_common.auth import Identity, require_customer_or_admin

app = create_app("auth-service")
CUSTOMER_DEMO_TOKEN = os.getenv("CUSTOMER_DEMO_TOKEN", "customer-demo-token")
ADMIN_DEMO_TOKEN = os.getenv("ADMIN_DEMO_TOKEN", "admin-demo-token")


@app.get("/demo/login/customer")
def customer_login() -> dict:
    return {
        "access_token": CUSTOMER_DEMO_TOKEN,
        "token_type": "bearer",
        "role": "customer",
        "email": "customer@example.com",
    }


@app.get("/demo/login/admin")
def admin_login() -> dict:
    return {
        "access_token": ADMIN_DEMO_TOKEN,
        "token_type": "bearer",
        "role": "admin",
        "email": "admin@example.com",
    }


@app.get("/validate")
def validate(identity: Identity = Depends(require_customer_or_admin)) -> dict:
    return {
        "subject": identity.subject,
        "role": identity.role,
        "email": identity.email,
        "issuer": "local-demo-auth",
    }