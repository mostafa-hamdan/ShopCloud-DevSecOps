// Admin frontend talks to one backend: the admin service. Admin in turn
// talks to catalog/checkout/auth via the internal channel. This mirrors
// the architecture diagram: the admin UI sits behind the internal ALB
// with one upstream.

export type Category = { id: string; name: string; slug: string };

export type Product = {
  id: string; sku: string; name: string; description: string;
  price_cents: number; currency: string; image_url: string;
  stock: number; category: Category | null;
  rating_avg: number; rating_count: number;
};

export type ProductList = { items: Product[]; total: number };

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

export type ReturnRequestEntry = ReturnRecord & {
  order_total_cents: number;
  currency: string;
  user_email: string;
};

export type Customer = {
  id: string; email: string; full_name: string; created_at: string;
};

export type CustomerList = { items: Customer[]; total: number };

export type AuthResponse = {
  access_token: string; token_type: "bearer";
  user_id: string; email: string; pool: "admin";
};

function envUrl(name: string, fallback: string): string {
  return Object.prototype.hasOwnProperty.call(process.env, name)
    ? process.env[name] ?? ""
    : fallback;
}

const ADMIN = envUrl("NEXT_PUBLIC_ADMIN_URL", "http://localhost:8005");
const AUTH = envUrl("NEXT_PUBLIC_AUTH_URL", "http://localhost:8004");

async function request<T>(url: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const adminAuth = {
  login: (email: string, password: string) =>
    request<AuthResponse>(`${AUTH}/auth/admin/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
};

export const products = {
  list: (token: string, q?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("limit", "200");
    return request<ProductList>(`${ADMIN}/admin/products?${p}`, {}, token);
  },
  get: (token: string, id: string) =>
    request<Product>(`${ADMIN}/admin/products/${id}`, {}, token),
  create: (token: string, payload: Partial<Product> & { sku: string; name: string; price_cents: number; category_slug?: string }) =>
    request<Product>(`${ADMIN}/admin/products`, {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),
  update: (token: string, id: string, patch: Record<string, unknown>) =>
    request<Product>(`${ADMIN}/admin/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }, token),
  remove: (token: string, id: string) =>
    request<void>(`${ADMIN}/admin/products/${id}`, { method: "DELETE" }, token),
};

export const categories = {
  list: (token: string) =>
    request<Category[]>(`${ADMIN}/admin/categories`, {}, token),
};

export const orders = {
  list: (token: string, q?: string, status?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    return request<Order[]>(`${ADMIN}/admin/orders?${p}`, {}, token);
  },
  refund: (token: string, id: string) =>
    request<Order>(`${ADMIN}/admin/orders/${id}/refund`, {
      method: "POST",
    }, token),
};

export const returns = {
  list: (token: string, status?: string) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    return request<ReturnRequestEntry[]>(`${ADMIN}/admin/returns?${p}`, {}, token);
  },
  approve: (token: string, id: string) =>
    request<ReturnRecord>(`${ADMIN}/admin/returns/${id}/approve`, {
      method: "POST",
    }, token),
  reject: (token: string, id: string) =>
    request<ReturnRecord>(`${ADMIN}/admin/returns/${id}/reject`, {
      method: "POST",
    }, token),
};

export const customers = {
  list: (token: string, q?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("limit", "100");
    return request<CustomerList>(`${ADMIN}/admin/customers?${p}`, {}, token);
  },
};
