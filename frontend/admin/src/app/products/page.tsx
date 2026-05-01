"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { products as productsApi, Product } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";

export default function ProductsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await productsApi.list(token, q || undefined);
      setItems(response.items);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [token, q]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!token) return;
    if (!confirm("Delete this product?")) return;
    try {
      await productsApi.remove(token, id);
      setItems((xs) => xs.filter((x) => x.id !== id));
      setError(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          href="/products/new"
          className="px-4 py-2 bg-accent text-white rounded hover:bg-blue-800"
        >
          New product
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or SKU..."
        className="w-full mb-4 px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
      />

      {error && <p className="text-red-700 mb-3">{error}</p>}

      <div className="bg-white rounded border border-black/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium text-right">Price</th>
              <th className="px-4 py-2 font-medium text-right">Stock</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-black/5">
                <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-2">
                  <Link href={`/products/${p.id}`} className="hover:text-accent">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-black/60">{p.category?.name ?? "-"}</td>
                <td className="px-4 py-2 text-right">{formatMoney(p.price_cents, p.currency)}</td>
                <td className={`px-4 py-2 text-right ${p.stock === 0 ? "text-red-700 font-medium" : ""}`}>
                  {p.stock}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/products/${p.id}`}
                    className="mr-3 text-xs text-accent hover:underline"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => remove(p.id)}
                    className="text-xs text-red-700 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-black/50">No products.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
