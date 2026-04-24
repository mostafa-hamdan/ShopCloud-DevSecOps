import os

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
import redis

from shopcloud_common.api import create_app
from shopcloud_common.auth import Identity, require_customer_or_admin

app = create_app("cart-service")
redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(ge=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1)


def cart_key(user_id: str) -> str:
    return f"cart:{user_id}"


@app.get("/cart")
def get_cart(identity: Identity = Depends(require_customer_or_admin)) -> dict:
    raw_cart = redis_client.hgetall(cart_key(identity.subject))
    items = [
        {"product_id": int(product_id), "quantity": int(quantity)}
        for product_id, quantity in raw_cart.items()
    ]
    return {"user_id": identity.subject, "items": items}


@app.post("/cart/items")
def add_item(payload: CartItemCreate, identity: Identity = Depends(require_customer_or_admin)) -> dict:
    redis_client.hincrby(cart_key(identity.subject), payload.product_id, payload.quantity)
    return {"message": "Item added", "product_id": payload.product_id}


@app.patch("/cart/items/{product_id}")
def update_item(product_id: int, payload: CartItemUpdate, identity: Identity = Depends(require_customer_or_admin)) -> dict:
    key = cart_key(identity.subject)
    if not redis_client.hexists(key, product_id):
        raise HTTPException(status_code=404, detail="Cart item not found")
    redis_client.hset(key, product_id, payload.quantity)
    return {"message": "Item updated", "product_id": product_id}


@app.delete("/cart/items/{product_id}")
def delete_item(product_id: int, identity: Identity = Depends(require_customer_or_admin)) -> dict:
    redis_client.hdel(cart_key(identity.subject), product_id)
    return {"message": "Item removed", "product_id": product_id}