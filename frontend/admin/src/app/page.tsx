"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { products, orders, Order, Product } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";

export default function Dashboard() {
  const { token } = useAdminAuth();
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([orders.list(token), products.list(token)])
      .then(([os, ps]) => {
        setRecentOrders(os.slice(0, 8));
        setLowStock(ps.items.filter((p) => p.stock <= 5).slice(0, 8));
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      });
  }, [token]);

  const totalRevenue = recentOrders
    .filter((o) => o.status !== "refunded")
    .reduce((sum, o) => sum + o.subtotal_cents, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      {error && <p className="text-red-700 mb-4">{error}</p>}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Recent orders" value={String(recentOrders.length)} />
        <Stat label="Recent revenue" value={formatMoney(totalRevenue)} />
        <Stat label="Low-stock products" value={String(lowStock.length)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded border border-black/10">
          <div className="px-4 py-3 border-b border-black/10 flex justify-between items-center">
            <h2 className="font-semibold">Recent orders</h2>
            <Link href="/orders" className="text-sm text-accent hover:underline">View all</Link>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-t border-black/5">
                  <td className="px-4 py-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-2">{o.user_email}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(o.subtotal_cents, o.currency)}</td>
                  <td className="px-4 py-2 text-xs capitalize text-black/60">{o.status}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td className="px-4 py-3 text-black/50">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="bg-white rounded border border-black/10">
          <div className="px-4 py-3 border-b border-black/10 flex justify-between items-center">
            <h2 className="font-semibold">Low stock</h2>
            <Link href="/products" className="text-sm text-accent hover:underline">Manage</Link>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id} className="border-t border-black/5">
                  <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className={`px-4 py-2 text-right font-medium ${
                    p.stock === 0 ? "text-red-700" : "text-amber-700"
                  }`}>
                    {p.stock} left
                  </td>
                </tr>
              ))}
              {lowStock.length === 0 && (
                <tr><td className="px-4 py-3 text-black/50">All stock levels healthy.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded border border-black/10 p-4">
      <p className="text-xs uppercase tracking-wider text-black/50">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
