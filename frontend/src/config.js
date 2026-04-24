export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME || "ShopCloud",
  api: {
    catalog: import.meta.env.VITE_CATALOG_API_URL || "http://localhost:8001",
    cart: import.meta.env.VITE_CART_API_URL || "http://localhost:8002",
    checkout: import.meta.env.VITE_CHECKOUT_API_URL || "http://localhost:8003",
    auth: import.meta.env.VITE_AUTH_API_URL || "http://localhost:8004",
    admin: import.meta.env.VITE_ADMIN_API_URL || "http://localhost:8005",
  },
};