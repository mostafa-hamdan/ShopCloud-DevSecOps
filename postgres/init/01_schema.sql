CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_email TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    total NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    line_total NUMERIC(10,2) NOT NULL
);

INSERT INTO products (name, category, description, price, stock, image_url)
VALUES
('Secure Laptop Stand', 'office', 'Aluminum stand for home office setups.', 39.99, 25, 'https://placehold.co/600x400?text=Laptop+Stand'),
('Cloud Hoodie', 'apparel', 'Lightweight hoodie for late-night deployments.', 54.50, 40, 'https://placehold.co/600x400?text=Cloud+Hoodie'),
('Ops Notebook', 'office', 'Hardcover notebook for architecture sketches.', 14.99, 80, 'https://placehold.co/600x400?text=Ops+Notebook'),
('Cluster Mug', 'lifestyle', 'Ceramic mug for resilient coffee service.', 12.50, 60, 'https://placehold.co/600x400?text=Cluster+Mug')
ON CONFLICT DO NOTHING;