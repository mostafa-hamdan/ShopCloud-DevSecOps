import { appConfig } from "../config";
import { apiRequest } from "./client";

const api = appConfig.api;

function authHeaders(token, includeJson = false) {
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchProducts({ search = "", category = "" } = {}) {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (category) query.set("category", category);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(api.catalog, `/products${suffix}`);
}

export async function fetchCart(token) {
  return apiRequest(api.cart, "/cart", { headers: authHeaders(token) });
}

export async function addCartItem(token, productId, quantity) {
  return apiRequest(api.cart, "/cart/items", {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify({ product_id: productId, quantity }),
  });
}

export async function updateCartItem(token, productId, quantity) {
  return apiRequest(api.cart, `/cart/items/${productId}`, {
    method: "PATCH",
    headers: authHeaders(token, true),
    body: JSON.stringify({ quantity }),
  });
}

export async function removeCartItem(token, productId) {
  return apiRequest(api.cart, `/cart/items/${productId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function runCheckout(token, customerEmail) {
  return apiRequest(api.checkout, "/checkout", {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify({ customer_email: customerEmail }),
  });
}

export async function loginCustomer() {
  return apiRequest(api.auth, "/demo/login/customer");
}

export async function loginAdmin() {
  return apiRequest(api.auth, "/demo/login/admin");
}

export async function fetchOrders(token) {
  return apiRequest(api.admin, "/admin/orders", { headers: authHeaders(token) });
}

export async function createProduct(token, payload) {
  return apiRequest(api.admin, "/admin/products", {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
}