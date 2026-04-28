"use client";

import { useCallback, useEffect, useState } from "react";
import { Order, orders as ordersApi } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";

const STATUSES = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "return_pending", label: "Return pending" },
  { value: "returned", label: "Returned" },
  { value: "refunded", label: "Refunded" },
];

export default function OrdersPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await ordersApi.list(token, debounced || undefined, statusFilter || undefined));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [token, debounced, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function refund(id: string) {
    if (!token) return;
    if (!confirm("Refund this order? Items will be restocked automatically.")) return;
    try {
      const updated = await ordersApi.refund(token, id);
      setItems((xs) => xs.map((x) => (x.id === id ? updated : x)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-black/15 rounded text-sm bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or order id…"
            className="px-3 py-1.5 border border-black/15 rounded text-sm bg-white w-56"
          />
        </div>
      </div>

      {error && <p className="text-red-700 mb-3">{error}</p>}

      {items.length === 0 ? (
        <p className="text-black/50">No orders match.</p>
      ) : (
        <div className="bg-white rounded border border-black/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.flatMap((o) => {
                const isOpen = expanded === o.id;
                const rows: React.ReactNode[] = [
                  <tr
                    key={`${o.id}-summary`}
                    className="border-t border-black/5 cursor-pointer hover:bg-black/[0.02]"
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-2">{o.user_email}</td>
                    <td className="px-4 py-2 text-black/60">
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatMoney(o.subtotal_cents, o.currency)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {o.status === "confirmed" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); refund(o.id); }}
                          className="text-xs text-red-700 hover:underline"
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>,
                ];
                if (isOpen) {
                  rows.push(
                    <tr key={`${o.id}-detail`} className="bg-black/[0.02]">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="text-xs uppercase text-black/50 mb-2">Lines</div>
                        <div className="grid gap-1">
                          {o.lines.map((l) => (
                            <div
                              key={l.product_id}
                              className="flex justify-between text-sm"
                            >
                              <span>{l.qty} × {l.name} <span className="text-black/40">[{l.sku}]</span></span>
                              <span className="font-medium">
                                {formatMoney(l.line_total_cents, o.currency)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {o.returns.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs uppercase text-black/50 mb-1">Returns</div>
                            {o.returns.map((r) => (
                              <div key={r.id} className="text-sm">
                                <StatusBadge status={r.status} /> ·{" "}
                                {new Date(r.requested_at).toLocaleString()}
                                {r.reason && ` — ${r.reason}`}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>,
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
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
  return (
    <span className={`text-xs px-2 py-0.5 rounded capitalize ${colors[status] || "bg-black/5 text-black/70"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
