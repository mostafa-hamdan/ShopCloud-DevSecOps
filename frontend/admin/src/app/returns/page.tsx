"use client";

import { useCallback, useEffect, useState } from "react";
import { ReturnRequestEntry, returns as returnsApi } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";

const STATUSES = ["", "requested", "approved", "rejected"];

export default function ReturnsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<ReturnRequestEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("requested");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await returnsApi.list(token, statusFilter || undefined));
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    if (!token) return;
    setBusy(id);
    try {
      if (action === "approve") await returnsApi.approve(token, id);
      else await returnsApi.reject(token, id);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(null); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-semibold">Returns</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-black/15 rounded text-sm bg-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s : "All"}</option>
          ))}
        </select>
      </div>

      {err && <p className="text-red-700 mb-3">{err}</p>}

      {items.length === 0 ? (
        <p className="text-black/50">No returns matching this filter.</p>
      ) : (
        <div className="bg-white border border-black/10 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Total</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Requested</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 font-mono text-xs">{r.order_id.slice(0, 8)}</td>
                  <td className="p-3">{r.user_email}</td>
                  <td className="p-3">{formatMoney(r.order_total_cents, r.currency)}</td>
                  <td className="p-3 max-w-xs truncate" title={r.reason}>
                    {r.reason || <span className="text-black/40">—</span>}
                  </td>
                  <td className="p-3 text-xs text-black/60">
                    {new Date(r.requested_at).toLocaleString()}
                  </td>
                  <td className="p-3 capitalize">{r.status}</td>
                  <td className="p-3 text-right">
                    {r.status === "requested" ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => decide(r.id, "approve")}
                          disabled={busy === r.id}
                          className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-black/30"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => decide(r.id, "reject")}
                          disabled={busy === r.id}
                          className="px-3 py-1 text-xs border border-black/15 rounded hover:border-red-500"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-black/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
