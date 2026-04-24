import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { appConfig } from "./config";
import {
  addCartItem,
  createProduct,
  fetchCart,
  fetchOrders,
  fetchProducts,
  loginAdmin,
  loginCustomer,
  removeCartItem,
  runCheckout,
  updateCartItem,
} from "./api/services";

const initialProduct = {
  name: "",
  category: "office",
  description: "",
  price: "",
  stock: "",
  image_url: "",
};

const productArtwork = {
  "Secure Laptop Stand": "/assets/products/laptop-stand.svg",
  "Cloud Hoodie": "/assets/products/cloud-hoodie.svg",
  "Ops Notebook": "/assets/products/ops-notebook.svg",
  "Cluster Mug": "/assets/products/cluster-mug.svg",
};

function productImage(product) {
  return productArtwork[product.name] || product.image_url || "/assets/products/ops-notebook.svg";
}

function Toast({ toast, onClose }) {
  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.type}`}>
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button className="ghost-button compact-button" onClick={onClose}>Dismiss</button>
    </div>
  );
}

function Header({ customerSession, adminSession, onDemoLogin, toast, onCloseToast }) {
  return (
    <header className="site-header">
      <nav className="top-nav">
        <Link className="brand-mark" to="/">
          <span className="brand-icon">S</span>
          <span>{appConfig.appName}</span>
        </Link>
        <div className="nav-links">
          <NavLink to="/" end>Storefront</NavLink>
          <NavLink to="/cart">Cart</NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </div>
        <div className="auth-actions">
          <button className="ghost-button compact-button" onClick={() => onDemoLogin("customer")}>
            {customerSession ? "Customer signed in" : "Sign in"}
          </button>
          <button className="ghost-button compact-button">Sign up</button>
          <button className="secondary-button compact-button" onClick={() => onDemoLogin("admin")}>
            {adminSession ? "Admin signed in" : "Admin sign in"}
          </button>
        </div>
      </nav>
      <Toast toast={toast} onClose={onCloseToast} />
    </header>
  );
}

function StorefrontPage({ products, search, category, setSearch, setCategory, reloadProducts, addToCart, customerSession }) {
  const categories = useMemo(() => [...new Set(products.map((product) => product.category))], [products]);

  return (
    <>
      <section className="store-hero">
        <div>
          <p className="eyebrow">Secure shopping demo</p>
          <h1>Everyday cloud essentials, ready for checkout.</h1>
          <p>Browse a small, realistic catalog backed by FastAPI, PostgreSQL, Redis, and a local invoice pipeline.</p>
          <div className="hero-actions-row">
            <Link className="button-link" to="/cart">View cart</Link>
            {!customerSession ? <span className="quiet-note">Use Sign in for the local customer demo.</span> : null}
          </div>
        </div>
      </section>

      <section className="shop-layout">
        <aside className="filter-sidebar">
          <h2>Shop</h2>
          <label>
            Search
            <input placeholder="Laptop, hoodie, mug..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button className="ghost-button" onClick={reloadProducts}>Refresh catalog</button>
          <div className="proof-note">
            <strong>Architecture note</strong>
            <p>Local Compose proves the customer flow before the public AWS path is provisioned.</p>
          </div>
        </aside>

        <section className="product-grid" aria-label="Product catalog">
          {products.map((product) => (
            <article key={product.id} className="product-card">
              <img src={productImage(product)} alt={product.name} />
              <div className="product-content">
                <div className="product-heading">
                  <span className="category-tag">{product.category}</span>
                  <span className={product.stock <= 10 ? "stock-tag low" : "stock-tag"}>{product.stock} left</span>
                </div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
              </div>
              <div className="product-footer">
                <strong>${product.price.toFixed(2)}</strong>
                <button onClick={() => addToCart(product.id)} disabled={!customerSession}>Add to cart</button>
              </div>
            </article>
          ))}
        </section>
      </section>
    </>
  );
}

function CartPage({ cart, products, customerSession, updateItem, removeItem, onCheckout, busy }) {
  const cartEntries = cart.map((item) => {
    const product = products.find((candidate) => candidate.id === item.product_id);
    return {
      ...item,
      name: product?.name || `Product #${item.product_id}`,
      price: product?.price || 0,
      category: product?.category || "unknown",
      image: product ? productImage(product) : "/assets/products/ops-notebook.svg",
    };
  });
  const totalItems = cartEntries.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartEntries.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const checkoutDisabled = !customerSession || cartEntries.length === 0 || busy;

  return (
    <section className="cart-page">
      <div className="page-title">
        <p className="eyebrow">Cart and checkout</p>
        <h1>Review order</h1>
      </div>
      <div className="cart-layout">
        <section className="cart-list">
          {cartEntries.length === 0 ? (
            <div className="empty-state">
              <h2>Your cart is empty</h2>
              <p>Add a product from the storefront before checkout.</p>
              <Link className="button-link" to="/">Continue shopping</Link>
            </div>
          ) : null}
          {cartEntries.map((item) => (
            <div key={item.product_id} className="cart-card">
              <img src={item.image} alt={item.name} />
              <div>
                <h2>{item.name}</h2>
                <p>{item.category}</p>
              </div>
              <div className="cart-actions">
                <button className="quantity-button" onClick={() => updateItem(item.product_id, item.quantity - 1)}>-</button>
                <span>{item.quantity}</span>
                <button className="quantity-button" onClick={() => updateItem(item.product_id, item.quantity + 1)}>+</button>
                <strong>${(item.price * item.quantity).toFixed(2)}</strong>
                <button className="ghost-button compact-button" onClick={() => removeItem(item.product_id)}>Remove</button>
              </div>
            </div>
          ))}
        </section>
        <aside className="order-summary">
          <h2>Order summary</h2>
          <div className="summary-row"><span>Items</span><strong>{totalItems}</strong></div>
          <div className="summary-row"><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
          <div className="summary-row"><span>Shipping</span><strong>Demo</strong></div>
          <div className="summary-row total"><span>Total</span><strong>${subtotal.toFixed(2)}</strong></div>
          <button onClick={onCheckout} disabled={checkoutDisabled}>{busy ? "Processing..." : "Complete checkout"}</button>
          {!customerSession ? <p className="helper-text">Sign in to enable checkout.</p> : null}
          {cartEntries.length === 0 ? <p className="helper-text">Checkout is disabled while the cart is empty.</p> : null}
          <div className="proof-note small">
            <strong>Invoice path</strong>
            <p>Checkout writes the order, emits the event, and the worker generates the PDF artifact.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function AdminPage({ adminSession, orders, products, form, setForm, onSubmit, busy }) {
  const [errors, setErrors] = useState({});
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const lowStock = products.filter((product) => product.stock <= 10).length;

  function validate() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Product name is required.";
    if (!form.description.trim()) nextErrors.description = "Description is required.";
    if (!form.category.trim()) nextErrors.category = "Category is required.";
    if (Number(form.price) <= 0) nextErrors.price = "Price must be greater than zero.";
    if (Number(form.stock) < 0 || Number.isNaN(Number(form.stock))) nextErrors.stock = "Stock must be zero or more.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    await onSubmit();
    setErrors({});
  }

  return (
    <section className="admin-page">
      <div className="page-title">
        <p className="eyebrow">Private admin demo</p>
        <h1>Admin dashboard</h1>
      </div>

      <div className="metric-grid">
        <div className="metric-card"><span>Total products</span><strong>{products.length}</strong></div>
        <div className="metric-card"><span>Recent orders</span><strong>{orders.length}</strong></div>
        <div className="metric-card"><span>Revenue</span><strong>${revenue.toFixed(2)}</strong></div>
        <div className="metric-card"><span>Low stock</span><strong>{lowStock}</strong></div>
      </div>

      {!adminSession ? (
        <div className="admin-alert">
          <strong>Admin sign in required</strong>
          <p>Use Admin sign in for the local demo. In AWS this page moves behind Cognito admin auth, internal ALB, and Client VPN.</p>
        </div>
      ) : null}

      <div className="admin-layout">
        <form className="polished-form" onSubmit={handleSubmit}>
          <h2 className="full-width">Add product</h2>
          <label>
            Product name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            {errors.name ? <span className="field-error">{errors.name}</span> : null}
          </label>
          <label>
            Category
            <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            {errors.category ? <span className="field-error">{errors.category}</span> : null}
          </label>
          <label className="full-width">
            Description
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="4" />
            {errors.description ? <span className="field-error">{errors.description}</span> : null}
          </label>
          <label>
            Price
            <input type="number" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            {errors.price ? <span className="field-error">{errors.price}</span> : null}
          </label>
          <label>
            Stock
            <input type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
            {errors.stock ? <span className="field-error">{errors.stock}</span> : null}
          </label>
          <label className="full-width">
            Image URL
            <input value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} />
          </label>
          <button className="full-width" type="submit" disabled={!adminSession || busy}>{busy ? "Saving..." : "Add product"}</button>
        </form>

        <section className="orders-panel">
          <h2>Recent orders</h2>
          <div className="orders">
            {orders.length === 0 ? <p className="empty-state">No orders yet.</p> : null}
            {orders.slice(0, 6).map((order) => (
              <div key={order.id} className="order-row">
                <div>
                  <strong>Order #{order.id}</strong>
                  <p>{order.customer_email}</p>
                </div>
                <strong>${order.total.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [customerToken, setCustomerToken] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [toast, setToast] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [newProduct, setNewProduct] = useState(initialProduct);

  const customerSession = Boolean(customerToken);
  const adminSession = Boolean(adminToken);

  function showToast(title, message, type = "info") {
    setToast({ title, message, type });
  }

  async function reloadProducts() {
    try {
      const data = await fetchProducts({ search, category });
      setProducts(data.items || []);
    } catch (error) {
      showToast("Catalog unavailable", error.message, "error");
    }
  }

  async function reloadCart() {
    if (!customerToken) {
      setCart([]);
      return;
    }
    try {
      const data = await fetchCart(customerToken);
      setCart(data.items || []);
    } catch (error) {
      showToast("Cart unavailable", error.message, "error");
    }
  }

  async function reloadOrders() {
    if (!adminToken) {
      setOrders([]);
      return;
    }
    try {
      const data = await fetchOrders(adminToken);
      setOrders(data.items || []);
    } catch (error) {
      showToast("Orders unavailable", error.message, "error");
    }
  }

  useEffect(() => {
    reloadProducts();
  }, [search, category]);

  useEffect(() => {
    reloadCart();
  }, [customerToken]);

  useEffect(() => {
    reloadOrders();
  }, [adminToken]);

  async function handleDemoLogin(role) {
    try {
      if (role === "customer") {
        const data = await loginCustomer();
        setCustomerToken(data.access_token);
        showToast("Signed in", "Customer demo session is ready.", "success");
        navigate("/");
      } else {
        const data = await loginAdmin();
        setAdminToken(data.access_token);
        showToast("Admin signed in", "Admin dashboard is ready.", "success");
        navigate("/admin");
      }
    } catch (error) {
      showToast("Sign in failed", error.message, "error");
    }
  }

  async function handleAddToCart(productId) {
    try {
      await addCartItem(customerToken, productId, 1);
      await reloadCart();
      showToast("Added to cart", "Item added to your cart.", "success");
    } catch (error) {
      showToast("Cart update failed", error.message, "error");
    }
  }

  async function handleUpdateItem(productId, quantity) {
    try {
      if (quantity <= 0) {
        await removeCartItem(customerToken, productId);
      } else {
        await updateCartItem(customerToken, productId, quantity);
      }
      await reloadCart();
    } catch (error) {
      showToast("Cart update failed", error.message, "error");
    }
  }

  async function handleRemoveItem(productId) {
    try {
      await removeCartItem(customerToken, productId);
      await reloadCart();
      showToast("Item removed", "Cart updated.", "success");
    } catch (error) {
      showToast("Cart removal failed", error.message, "error");
    }
  }

  async function handleCheckout() {
    setCheckoutBusy(true);
    try {
      const data = await runCheckout(customerToken, "customer@example.com");
      await reloadCart();
      await reloadProducts();
      await reloadOrders();
      showToast("Checkout complete", `Order #${data.order_id} created and invoice event emitted.`, "success");
    } catch (error) {
      showToast("Checkout failed", error.message, "error");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function handleCreateProduct() {
    setAdminBusy(true);
    try {
      const payload = {
        ...newProduct,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
      };
      const result = await createProduct(adminToken, payload);
      await reloadProducts();
      showToast("Product created", `Product #${result.product_id} is available in the catalog.`, "success");
      setNewProduct(initialProduct);
    } catch (error) {
      showToast("Admin action failed", error.message, "error");
    } finally {
      setAdminBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <Header
        customerSession={customerSession}
        adminSession={adminSession}
        onDemoLogin={handleDemoLogin}
        toast={toast}
        onCloseToast={() => setToast(null)}
      />

      <Routes>
        <Route
          path="/"
          element={
            <StorefrontPage
              products={products}
              search={search}
              category={category}
              setSearch={setSearch}
              setCategory={setCategory}
              reloadProducts={reloadProducts}
              addToCart={handleAddToCart}
              customerSession={customerSession}
            />
          }
        />
        <Route
          path="/cart"
          element={
            <CartPage
              cart={cart}
              products={products}
              customerSession={customerSession}
              updateItem={handleUpdateItem}
              removeItem={handleRemoveItem}
              onCheckout={handleCheckout}
              busy={checkoutBusy}
            />
          }
        />
        <Route
          path="/admin"
          element={
            <AdminPage
              adminSession={adminSession}
              orders={orders}
              products={products}
              form={newProduct}
              setForm={setNewProduct}
              onSubmit={handleCreateProduct}
              busy={adminBusy}
            />
          }
        />
        <Route
          path="*"
          element={
            <section className="not-found">
              <p className="eyebrow">Unknown route</p>
              <h1>That page is outside the MVP scope.</h1>
              <Link className="button-link" to="/">Return to storefront</Link>
            </section>
          }
        />
      </Routes>
    </div>
  );
}