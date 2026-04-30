// Thin wrapper around fetch. Pages decide their own caching strategy.

export type Category = { id: string; name: string; slug: string };

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string;
  stock: number;
  category: Category | null;
  rating_avg: number;
  rating_count: number;
};

export type ProductList = { items: Product[]; total: number };

export type CartLine = {
  product_id: string; qty: number; name: string;
  price_cents: number; currency: string; image_url: string;
  line_total_cents: number; in_stock: boolean;
};

export type Cart = {
  user_id: string; items: CartLine[];
  subtotal_cents: number; currency: string;
};

export type WishlistEntry = {
  product_id: string; name: string;
  price_cents: number; currency: string; image_url: string; stock: number;
};

export type Wishlist = { user_id: string; items: WishlistEntry[] };

export type OrderLine = {
  product_id: string; sku: string; name: string;
  qty: number; unit_price_cents: number; line_total_cents: number;
};

export type ReturnRecord = {
  id: string; order_id: string; status: string; reason: string;
  requested_at: string; resolved_at: string | null;
};

export type Order = {
  id: string; user_id: string; user_email: string; status: string;
  subtotal_cents: number; currency: string; created_at: string;
  ship_to: Record<string, unknown> | null;
  lines: OrderLine[];
  returns: ReturnRecord[];
};

export type AuthResponse = {
  access_token: string; token_type: "bearer";
  user_id: string; email: string; pool: "customer" | "admin";
};

export type Profile = { user_id: string; email: string; full_name: string };

export type Address = {
  id: string;
  label: string; full_name: string;
  line1: string; line2: string;
  city: string; region: string; postal_code: string; country: string;
  is_default: boolean;
};

export type AddressInput = Omit<Address, "id">;

export type Review = {
  id: string; product_id: string; user_id: string; user_email: string;
  rating: number; title: string; body: string; created_at: string;
};

function envUrl(name: string, fallback: string): string {
  return Object.prototype.hasOwnProperty.call(process.env, name)
    ? process.env[name] ?? ""
    : fallback;
}

const AUTH = envUrl("NEXT_PUBLIC_AUTH_URL", "http://localhost:8004");
const CATALOG = envUrl("NEXT_PUBLIC_CATALOG_URL", "http://localhost:8001");
const CART = envUrl("NEXT_PUBLIC_CART_URL", "http://localhost:8002");
const CHECKOUT = envUrl("NEXT_PUBLIC_CHECKOUT_URL", "http://localhost:8003");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

const bearer = (t: string | null): Record<string, string> =>
  t ? { Authorization: `Bearer ${t}` } : {};

// ---------- catalog ----------
export const catalog = {
  list: (q?: string, category?: string, limit = 20, offset = 0) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    return request<ProductList>(`${CATALOG}/catalog/products?${p}`);
  },
  get: (id: string) => request<Product>(`${CATALOG}/catalog/products/${id}`),
  categories: () => request<Category[]>(`${CATALOG}/catalog/categories`),
};

// ---------- reviews ----------
export const reviews = {
  list: (productId: string) =>
    request<Review[]>(`${CATALOG}/catalog/products/${productId}/reviews`),
  create: (token: string, productId: string, rating: number, title: string, body: string) =>
    request<Review>(`${CATALOG}/catalog/products/${productId}/reviews`, {
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify({ rating, title, body }),
    }),
  remove: (token: string, productId: string, reviewId: string) =>
    request<void>(`${CATALOG}/catalog/products/${productId}/reviews/${reviewId}`, {
      method: "DELETE",
      headers: bearer(token),
    }),
};

// ---------- auth ----------
export const auth = {
  register: (email: string, password: string, full_name = "") =>
    request<AuthResponse>(`${AUTH}/auth/customer/register`, {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>(`${AUTH}/auth/customer/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: (token: string) => request<Profile>(`${AUTH}/auth/me`, { headers: bearer(token) }),
  updateMe: (token: string, full_name: string) =>
    request<Profile>(`${AUTH}/auth/me`, {
      method: "PATCH", headers: bearer(token),
      body: JSON.stringify({ full_name }),
    }),
};

// ---------- addresses ----------
export const addresses = {
  list: (token: string) =>
    request<Address[]>(`${AUTH}/auth/me/addresses`, { headers: bearer(token) }),
  add: (token: string, payload: AddressInput) =>
    request<Address>(`${AUTH}/auth/me/addresses`, {
      method: "POST", headers: bearer(token), body: JSON.stringify(payload),
    }),
  update: (token: string, id: string, payload: AddressInput) =>
    request<Address>(`${AUTH}/auth/me/addresses/${id}`, {
      method: "PATCH", headers: bearer(token), body: JSON.stringify(payload),
    }),
  remove: (token: string, id: string) =>
    request<void>(`${AUTH}/auth/me/addresses/${id}`, {
      method: "DELETE", headers: bearer(token),
    }),
};

// ---------- cart ----------
export const cart = {
  get: (token: string) => request<Cart>(`${CART}/cart`, { headers: bearer(token) }),
  add: (token: string, product_id: string, qty: number) =>
    request<Cart>(`${CART}/cart/items`, {
      method: "POST", headers: bearer(token),
      body: JSON.stringify({ product_id, qty }),
    }),
  setQty: (token: string, product_id: string, qty: number) =>
    request<Cart>(`${CART}/cart/items/${product_id}`, {
      method: "PUT", headers: bearer(token),
      body: JSON.stringify({ product_id, qty }),
    }),
  remove: (token: string, product_id: string) =>
    request<Cart>(`${CART}/cart/items/${product_id}`, {
      method: "DELETE", headers: bearer(token),
    }),
  clear: (token: string) =>
    request<Cart>(`${CART}/cart`, { method: "DELETE", headers: bearer(token) }),
};

// ---------- wishlist ----------
export const wishlist = {
  get: (token: string) => request<Wishlist>(`${CART}/wishlist`, { headers: bearer(token) }),
  add: (token: string, product_id: string) =>
    request<Wishlist>(`${CART}/wishlist/items`, {
      method: "POST", headers: bearer(token),
      body: JSON.stringify({ product_id }),
    }),
  remove: (token: string, product_id: string) =>
    request<Wishlist>(`${CART}/wishlist/items/${product_id}`, {
      method: "DELETE", headers: bearer(token),
    }),
};

// ---------- checkout ----------
export const checkout = {
  place: (token: string, address_id?: string) =>
    request<Order>(`${CHECKOUT}/checkout`, {
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify({ address_id }),
    }),
  myOrders: (token: string) =>
    request<Order[]>(`${CHECKOUT}/checkout/orders`, { headers: bearer(token) }),
  getOrder: (token: string, id: string) =>
    request<Order>(`${CHECKOUT}/checkout/orders/${id}`, { headers: bearer(token) }),
  requestReturn: (token: string, orderId: string, reason: string) =>
    request<ReturnRecord>(`${CHECKOUT}/checkout/orders/${orderId}/return`, {
      method: "POST", headers: bearer(token),
      body: JSON.stringify({ reason }),
    }),
};
