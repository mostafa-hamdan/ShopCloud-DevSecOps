"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Address, addresses as addrApi, Cart, cart as cartApi, checkout as checkoutApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";

export default function CartPage() {
  const { token, isReady } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [c, a] = await Promise.all([cartApi.get(token), addrApi.list(token)]);
      setCart(c);
      setAddresses(a);
      const def = a.find((x) => x.is_default);
      if (def) setSelectedAddrId(def.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load cart");
    }
  }, [token]);

  useEffect(() => {
    if (!isReady) return;
    if (!token) { router.push("/login?next=/cart"); return; }
    load();
  }, [isReady, token, router, load]);

  async function setQty(productId: string, qty: number) {
    if (!token) return;
    if (qty <= 0) await cartApi.remove(token, productId).then(setCart);
    else await cartApi.setQty(token, productId, qty).then(setCart);
  }

  async function placeOrder() {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      const order = await checkoutApi.place(token, selectedAddrId);
      router.push(`/orders/${order.id}?placed=1`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isReady || !token) return null;
  if (!cart) return <p className="text-black/60">Loading…</p>;

  if (cart.items.length === 0) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-semibold mb-3">Your cart is empty</h1>
        <Link href="/" className="text-accent hover:underline">Continue shopping</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">Your cart</h1>
      <div className="bg-white border border-black/10 rounded divide-y divide-black/10">
        {cart.items.map((line) => (
          <div key={line.product_id} className="flex gap-4 p-4 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={line.image_url} alt={line.name}
                 className="w-20 h-20 object-cover rounded border border-black/10" />
            <div className="flex-1">
              <p className="font-medium">{line.name}</p>
              <p className="text-sm text-black/60">
                {formatMoney(line.price_cents, line.currency)} each
              </p>
              {!line.in_stock && (
                <p className="text-sm text-red-700 mt-1">Not enough stock</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setQty(line.product_id, line.qty - 1)}
                      className="w-8 h-8 border border-black/15 rounded hover:border-accent">−</button>
              <span className="w-8 text-center">{line.qty}</span>
              <button onClick={() => setQty(line.product_id, line.qty + 1)}
                      className="w-8 h-8 border border-black/15 rounded hover:border-accent">+</button>
            </div>
            <p className="w-24 text-right font-semibold">
              {formatMoney(line.line_total_cents, line.currency)}
            </p>
          </div>
        ))}
      </div>

      {addresses.length > 0 && (
        <section className="mt-6 bg-white border border-black/10 rounded p-4">
          <p className="text-sm font-medium mb-2">Ship to</p>
          <select
            value={selectedAddrId || ""}
            onChange={(e) => setSelectedAddrId(e.target.value || undefined)}
            className="w-full px-3 py-2 border border-black/15 rounded bg-white"
          >
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} — {a.line1}, {a.city}, {a.country}
                {a.is_default ? " (default)" : ""}
              </option>
            ))}
          </select>
        </section>
      )}

      {addresses.length === 0 && (
        <p className="mt-4 text-sm text-black/60">
          You haven&rsquo;t added a shipping address yet. <Link href="/account"
          className="text-accent hover:underline">Add one in Account</Link> — it&rsquo;s
          optional but recommended.
        </p>
      )}

      <div className="flex justify-between items-center mt-6 p-4 bg-white border border-black/10 rounded">
        <span className="text-lg">Subtotal</span>
        <span className="text-2xl font-semibold">
          {formatMoney(cart.subtotal_cents, cart.currency)}
        </span>
      </div>

      {error && <p className="text-red-700 mt-3">{error}</p>}

      <div className="mt-6 flex justify-end gap-3">
        <Link href="/"
              className="px-5 py-2.5 border border-black/15 rounded hover:border-accent">
          Continue shopping
        </Link>
        <button
          onClick={placeOrder}
          disabled={busy || cart.items.some((l) => !l.in_stock)}
          className="px-5 py-2.5 bg-accent text-white rounded hover:bg-emerald-800 disabled:bg-black/30"
        >
          {busy ? "Placing…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
