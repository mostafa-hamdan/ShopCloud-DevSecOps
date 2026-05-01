"use client";

import { useState } from "react";
import { Category } from "@/lib/api";
import { parseMoneyToCents } from "@/lib/money";

export type ProductFormValues = {
  sku: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string;
  stock: number;
  category_slug?: string;
};

export default function ProductForm({
  initial,
  categories,
  submitLabel,
  onSubmit,
  lockSku = false,
}: {
  initial?: Partial<ProductFormValues>;
  categories: Category[];
  submitLabel: string;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  lockSku?: boolean;
}) {
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceText, setPriceText] = useState(
    initial?.price_cents != null ? (initial.price_cents / 100).toFixed(2) : "",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [stock, setStock] = useState(initial?.stock ?? 0);
  const [categorySlug, setCategorySlug] = useState(initial?.category_slug ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        sku,
        name,
        description,
        price_cents: parseMoneyToCents(priceText),
        currency,
        image_url: imageUrl,
        stock,
        category_slug: categorySlug || undefined,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">SKU</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            disabled={lockSku}
            required
            className="w-full px-3 py-2 border border-black/15 rounded bg-white disabled:bg-black/5"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Currency</label>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            required
            className="w-full px-3 py-2 border border-black/15 rounded bg-white"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-black/15 rounded bg-white"
        />
      </div>
      <div>
        <label className="block text-sm mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-black/15 rounded bg-white"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm mb-1">Price</label>
          <input
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder="0.00"
            required
            className="w-full px-3 py-2 border border-black/15 rounded bg-white"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Stock</label>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
            className="w-full px-3 py-2 border border-black/15 rounded bg-white"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Category</label>
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="w-full px-3 py-2 border border-black/15 rounded bg-white"
          >
            <option value="">-</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">Image URL</label>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full px-3 py-2 border border-black/15 rounded bg-white"
        />
      </div>
      {error && <p className="text-red-700 text-sm">{error}</p>}
      <button
        disabled={busy}
        className="px-5 py-2.5 bg-accent text-white rounded hover:bg-blue-800 disabled:bg-black/30"
      >
        {busy ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
