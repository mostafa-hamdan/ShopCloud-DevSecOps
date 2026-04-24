import os

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from psycopg.rows import dict_row
import psycopg

from shopcloud_common.api import create_app
from shopcloud_common.auth import require_admin

app = create_app("admin-service")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://shopcloud:shopcloud_dev_password@postgres:5432/shopcloud")


class ProductCreate(BaseModel):
    name: str
    category: str
    description: str
    price: float
    stock: int = Field(ge=0)
    image_url: str | None = None


class ProductUpdate(ProductCreate):
    pass


class StockUpdate(BaseModel):
    stock: int = Field(ge=0)


def get_connection():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


@app.get("/admin/products")
def list_products(_: dict = Depends(require_admin)) -> dict:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, name, category, description, price, stock, image_url FROM products ORDER BY id")
        products = cur.fetchall()
    for product in products:
        product["price"] = float(product["price"])
    return {"items": products}


@app.post("/admin/products")
def create_product(payload: ProductCreate, _: dict = Depends(require_admin)) -> dict:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO products (name, category, description, price, stock, image_url) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (payload.name, payload.category, payload.description, payload.price, payload.stock, payload.image_url),
        )
        product_id = cur.fetchone()["id"]
        conn.commit()
    return {"message": "Product created", "product_id": product_id}


@app.put("/admin/products/{product_id}")
def update_product(product_id: int, payload: ProductUpdate, _: dict = Depends(require_admin)) -> dict:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE products SET name = %s, category = %s, description = %s, price = %s, stock = %s, image_url = %s WHERE id = %s",
            (payload.name, payload.category, payload.description, payload.price, payload.stock, payload.image_url, product_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        conn.commit()
    return {"message": "Product updated", "product_id": product_id}


@app.patch("/admin/products/{product_id}/stock")
def update_stock(product_id: int, payload: StockUpdate, _: dict = Depends(require_admin)) -> dict:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("UPDATE products SET stock = %s WHERE id = %s", (payload.stock, product_id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        conn.commit()
    return {"message": "Stock updated", "product_id": product_id}


@app.get("/admin/orders")
def list_orders(_: dict = Depends(require_admin)) -> dict:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, customer_email, customer_id, total, created_at FROM orders ORDER BY created_at DESC"
        )
        orders = cur.fetchall()
    for order in orders:
        order["total"] = float(order["total"])
    return {"items": orders}