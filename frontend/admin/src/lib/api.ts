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

const ADMIN = envUrl("NEXT_PUBLIC_ADMIN_URL", "/admin");
const AUTH = envUrl("NEXT_PUBLIC_AUTH_URL", "/auth");

function detailToMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => detailToMessage(item)).join(", ");
  }
  if (detail && typeof detail === "object") {
    if ("msg" in detail && typeof detail.msg === "string") return detail.msg;
    return JSON.stringify(detail);
  }
  return "Request failed";
}

function expectArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "value" in data && Array.isArray((data as { value: unknown[] }).value)) {
    return (data as { value: T[] }).value;
  }
  return [];
}

function expectProductList(data: unknown): ProductList {
  if (data && typeof data === "object" && "items" in data) {
    const items = Array.isArray((data as { items: unknown[] }).items)
      ? ((data as { items: Product[] }).items)
      : [];
    const total = typeof (data as { total?: unknown }).total === "number"
      ? ((data as { total: number }).total)
      : items.length;
    return { items, total };
  }
  const items = expectArray<Product>(data);
  return { items, total: items.length };
}

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
      detail = detailToMessage(body.detail ?? body);
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
  list: async (token: string, q?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("limit", "100");
    const data = await request<unknown>(`${ADMIN}/products?${p}`, {}, token);
    return expectProductList(data);
  },
  get: (token: string, id: string) =>
    request<Product>(`${ADMIN}/products/${id}`, {}, token),
  create: (token: string, payload: Partial<Product> & { sku: string; name: string; price_cents: number; category_slug?: string }) =>
    request<Product>(`${ADMIN}/products`, {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),
  update: (token: string, id: string, patch: Record<string, unknown>) =>
    request<Product>(`${ADMIN}/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }, token),
  remove: (token: string, id: string) =>
    request<void>(`${ADMIN}/products/${id}`, { method: "DELETE" }, token),
};

export const categories = {
  list: async (token: string) => {
    const data = await request<unknown>(`${ADMIN}/categories`, {}, token);
    return expectArray<Category>(data);
  },
};

export const orders = {
  list: async (token: string, q?: string, status?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    const data = await request<unknown>(`${ADMIN}/orders?${p}`, {}, token);
    return expectArray<Order>(data);
  },
  refund: (token: string, id: string) =>
    request<Order>(`${ADMIN}/orders/${id}/refund`, {
      method: "POST",
    }, token),
};

export const returns = {
  list: async (token: string, status?: string) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    const data = await request<unknown>(`${ADMIN}/returns?${p}`, {}, token);
    return expectArray<ReturnRequestEntry>(data);
  },
  approve: (token: string, id: string) =>
    request<ReturnRecord>(`${ADMIN}/returns/${id}/approve`, {
      method: "POST",
    }, token),
  reject: (token: string, id: string) =>
    request<ReturnRecord>(`${ADMIN}/returns/${id}/reject`, {
      method: "POST",
    }, token),
};

export const customers = {
  list: async (token: string, q?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("limit", "100");
    const data = await request<unknown>(`${ADMIN}/customers?${p}`, {}, token);
    const items = expectArray<Customer>(data);
    return { items, total: items.length };
  },
};
