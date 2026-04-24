import os

from fastapi import HTTPException, Query
from psycopg.rows import dict_row
import psycopg

from shopcloud_common.api import create_app

app = create_app("catalog-service")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://shopcloud:shopcloud_dev_password@postgres:5432/shopcloud")


def get_connection():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


@app.get("/products")
def list_products(search: str | None = Query(default=None), category: str | None = Query(default=None)) -> dict:
    query = "SELECT id, name, category, description, price, stock, image_url FROM products WHERE 1=1"
    params: list[str] = []
    if search:
        query += " AND LOWER(name) LIKE %s"
        params.append(f"%{search.lower()}%")
    if category:
        query += " AND LOWER(category) = %s"
        params.append(category.lower())
    query += " ORDER BY id"

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        products = cur.fetchall()

    for product in products:
        product["price"] = float(product["price"])
    return {"items": products}


@app.get("/products/{product_id}")
def get_product(product_id: int) -> dict:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, category, description, price, stock, image_url FROM products WHERE id = %s",
            (product_id,),
        )
        product = cur.fetchone()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product["price"] = float(product["price"])
    return product