from dataclasses import dataclass

from fastapi import Header, HTTPException, status

from .config import get_settings


@dataclass
class Identity:
    subject: str
    role: str
    email: str


class DemoJWTValidator:
    def __init__(self) -> None:
        settings = get_settings()
        self._customer_token = settings.customer_demo_token
        self._admin_token = settings.admin_demo_token

    def validate(self, authorization: str | None) -> Identity:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

        token = authorization.replace("Bearer ", "", 1).strip()
        if token == self._customer_token:
            return Identity(subject="customer-demo", role="customer", email="customer@example.com")
        if token == self._admin_token:
            return Identity(subject="admin-demo", role="admin", email="admin@example.com")

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid demo token")


validator = DemoJWTValidator()


def require_customer_or_admin(authorization: str | None = Header(default=None)) -> Identity:
    return validator.validate(authorization)


def require_admin(authorization: str | None = Header(default=None)) -> Identity:
    identity = validator.validate(authorization)
    if identity.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return identity