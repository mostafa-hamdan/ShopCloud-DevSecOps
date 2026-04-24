from datetime import datetime, timezone
import os

from fastapi import Depends, HTTPException
from pydantic import BaseModel, EmailStr
from psycopg.rows import dict_row
import psycopg
import redis

from shopcloud_common.api import create_app
from shopcloud_common.auth import Identity, require_customer_or_admin
from shopcloud_common.events import write_checkout_event

app = create_app("checkout-service")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://shopcloud:shopcloud_dev_password@postgres:5432/shopcloud")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
EVENTS_PATH = os.getenv("EVENTS_PATH", "/app/runtime/events")
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


class CheckoutRequest(BaseModel):
    customer_email: EmailStr


def get_connection():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def get_cart_items(user_id: str) -> list[tuple[int, int]]:
    raw_cart = redis_client.hgetall(f"cart:{user_id}")
    return [(int(product_id), int(quantity)) for product_id, quantity in raw_cart.items()]


@app.post("/checkout")
def checkout(payload: CheckoutRequest, identity: Identity = Depends(require_customer_or_admin)) -> dict:
    cart_items = get_cart_items(identity.subject)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    product_ids = [item[0] for item in cart_items]
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, price, stock FROM products WHERE id = ANY(%s::int[])",
            (product_ids,),
        )
        products = {row["id"]: row for row in cur.fetchall()}

        order_lines = []
        total = 0.0
        for product_id, quantity in cart_items:
            product = products.get(product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
            if product["stock"] < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for product {product['name']}")
            line_total = float(product["price"]) * quantity
            total += line_total
            order_lines.append(
                {
                    "product_id": product_id,
                    "product_name": product["name"],
                    "unit_price": float(product["price"]),
                    "quantity": quantity,
                    "line_total": line_total,
                }
            )

        cur.execute(
            "INSERT INTO orders (customer_email, customer_id, total) VALUES (%s, %s, %s) RETURNING id",
            (payload.customer_email, identity.subject, total),
        )
        order_id = cur.fetchone()["id"]

        for line in order_lines:
            cur.execute(
                "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES (%s, %s, %s, %s, %s, %s)",
                (order_id, line["product_id"], line["product_name"], line["unit_price"], line["quantity"], line["line_total"]),
            )
            cur.execute(
                "UPDATE products SET stock = stock - %s WHERE id = %s",
                (line["quantity"], line["product_id"]),
            )
        conn.commit()

    redis_client.delete(f"cart:{identity.subject}")
    event_path = write_checkout_event(
        EVENTS_PATH,
        {
            "order_id": order_id,
            "customer_email": payload.customer_email,
            "customer_id": identity.subject,
            "line_items": order_lines,
            "totals": {"grand_total": round(total, 2)},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {"message": "Checkout complete", "order_id": order_id, "event_path": event_path}