"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { checkout, Order } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";

function OrderDetail() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const justPlaced = search.get("placed") === "1";

  const { token, isReady } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReturn, setShowReturn] = useState(false);

  const load = useCallback(async () => {
    if (!token || !params?.id) return;
    try { setOrder(await checkout.getOrder(token, params.id)); }
    catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    }
  }, [token, params?.id]);

  useEffect(() => {
    if (!isReady) return;
    if (!token) { router.push("/login"); return; }
    load();
  }, [isReady, token, router, load]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!order) return <p className="text-black/60">Loading…</p>;

  const canReturn = order.status === "confirmed";
  const hasOpenReturn = order.returns.some((r) => r.status === "requested");

  return (
    <div>
      {justPlaced && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded">
          <p className="font-medium text-emerald-900">Thanks for your order!</p>
          <p className="text-sm text-emerald-800/80">
            We&rsquo;re generating your invoice — it&rsquo;ll arrive in your inbox shortly.
          </p>
        </div>
      )}

      <Link href="/orders" className="text-sm text-accent hover:underline">
        ← All orders
      </Link>
      <h1 className="text-3xl font-semibold mt-2 mb-1">Order {order.id.slice(0, 8)}</h1>
      <p className="text-sm text-black/60 mb-6">
        Placed {new Date(order.created_at).toLocaleString()} ·{" "}
        <StatusBadge status={order.status} />
      </p>

      <div className="bg-white border border-black/10 rounded divide-y divide-black/10">
        {order.lines.map((l) => (
          <div key={l.product_id} className="flex justify-between p-4">
            <div>
              <p className="font-medium">{l.name}</p>
              <p className="text-sm text-black/60">
                {l.qty} × {formatMoney(l.unit_price_cents, order.currency)}
              </p>
            </div>
            <p className="font-semibold">
              {formatMoney(l.line_total_cents, order.currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-4 p-4 bg-white border border-black/10 rounded">
        <span>Total</span>
        <span className="text-xl font-semibold">
          {formatMoney(order.subtotal_cents, order.currency)}
        </span>
      </div>

      {order.returns.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Returns</h2>
          <div className="space-y-2">
            {order.returns.map((r) => (
              <div key={r.id} className="bg-white border border-black/10 rounded p-3 text-sm">
                <p>
                  <StatusBadge status={r.status} /> ·{" "}
                  Requested {new Date(r.requested_at).toLocaleString()}
                </p>
                {r.reason && <p className="mt-1 text-black/60">Reason: {r.reason}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {canReturn && !hasOpenReturn && (
        <section className="mt-8">
          {!showReturn ? (
            <button
              onClick={() => setShowReturn(true)}
              className="text-sm text-accent hover:underline"
            >
              Request a return
            </button>
          ) : (
            <ReturnForm
              orderId={order.id}
              token={token!}
              onDone={() => { setShowReturn(false); load(); }}
              onCancel={() => setShowReturn(false)}
            />
          )}
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700",
    refunded: "bg-red-50 text-red-700",
    return_pending: "bg-amber-50 text-amber-700",
    returned: "bg-blue-50 text-blue-700",
    requested: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
  };
  const color = colors[status] || "bg-black/5 text-black/70";
  return (
    <span className={`text-xs px-2 py-0.5 rounded capitalize ${color}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function ReturnForm({
  orderId, token, onDone, onCancel,
}: {
  orderId: string; token: string; onDone: () => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await checkout.requestReturn(token, orderId, reason);
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}
          className="bg-white border border-black/10 rounded p-4 space-y-3">
      <h3 className="font-medium">Request a return</h3>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Tell us briefly why you'd like to return this order"
        rows={3}
        className="w-full px-3 py-2 border border-black/15 rounded"
      />
      {err && <p className="text-red-700 text-sm">{err}</p>}
      <div className="flex gap-2">
        <button
          disabled={busy}
          className="px-4 py-2 bg-accent text-white rounded hover:bg-emerald-800 disabled:bg-black/30"
        >
          {busy ? "Submitting…" : "Submit request"}
        </button>
        <button
          type="button" onClick={onCancel}
          className="px-4 py-2 border border-black/15 rounded hover:border-black/30"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={null}>
      <OrderDetail />
    </Suspense>
  );
}
