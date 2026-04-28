"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkout, Order } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";

export default function OrdersPage() {
  const { token, isReady } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!token) {
      router.push("/login?next=/orders");
      return;
    }
    checkout
      .myOrders(token)
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, [isReady, token, router]);

  if (!isReady || !token) return null;
  if (error) return <p className="text-red-700">{error}</p>;
  if (!orders) return <p className="text-black/60">Loading…</p>;

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-semibold mb-3">No orders yet</h1>
        <Link href="/" className="text-accent hover:underline">Start shopping</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">Your orders</h1>
      <div className="space-y-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className="block bg-white border border-black/10 rounded p-4 hover:border-accent"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Order {o.id.slice(0, 8)}</p>
                <p className="text-sm text-black/60">
                  {new Date(o.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {formatMoney(o.subtotal_cents, o.currency)}
                </p>
                <p className="text-sm capitalize text-black/60">{o.status}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
