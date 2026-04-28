"use client";

import { useCallback, useEffect, useState } from "react";
import { Customer, customers as customersApi } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";

export default function CustomersPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // simple debounce so we don't fire on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await customersApi.list(token, debounced || undefined);
      setItems(r.items);
      setTotal(r.total);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }, [token, debounced]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex justify-between items-center mb-5 gap-4">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email or name…"
          className="px-3 py-1.5 border border-black/15 rounded text-sm bg-white w-64"
        />
      </div>

      {err && <p className="text-red-700 mb-3">{err}</p>}

      <p className="text-sm text-black/60 mb-3">
        {total} {total === 1 ? "customer" : "customers"}
        {debounced && ` matching "${debounced}"`}
      </p>

      {items.length === 0 ? (
        <p className="text-black/50">No customers found.</p>
      ) : (
        <div className="bg-white border border-black/10 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Name</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="p-3">{c.email}</td>
                  <td className="p-3">{c.full_name || <span className="text-black/40">—</span>}</td>
                  <td className="p-3 text-xs text-black/60">
                    {new Date(c.created_at).toLocaleDateString()}
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
