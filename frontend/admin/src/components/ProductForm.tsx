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
  const [previewOk, setPreviewOk] = useState(true);

  const trimmedImageUrl = imageUrl.trim();
  const directImagePattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
  const localImagePattern = /^\/products\/.+\.(jpg|jpeg|png|webp)$/i;

  function validateImageUrl(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (localImagePattern.test(trimmed)) return null;
    if (directImagePattern.test(trimmed)) return null;
    if (/^https?:\/\/(www\.)?ibb\.co\//i.test(trimmed) || /^https?:\/\/(www\.)?imgbb\.com\//i.test(trimmed)) {
      return "Use the direct image file URL, not the image viewer page.";
    }
    if (/^https?:\/\/images\.google\./i.test(trimmed) || /^https?:\/\/www\.google\./i.test(trimmed)) {
      return "Google Images page links do not work here. Use a direct image file URL.";
    }
    return "Use a direct image URL ending in .jpg, .jpeg, .png, or .webp, or a local path like /products/example.jpg.";
  }

  const imageUrlError = validateImageUrl(trimmedImageUrl);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (imageUrlError) {
        throw new Error(imageUrlError);
      }
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
          onChange={(e) => {
            setImageUrl(e.target.value);
            setPreviewOk(true);
          }}
          className="w-full px-3 py-2 border border-black/15 rounded bg-white"
        />
        <p className="mt-1 text-xs text-black/60">
          Use a direct image URL ending in .jpg, .jpeg, .png, .webp, or a local path like
          {" "}<code>/products/example.jpg</code>. Viewer links such as <code>ibb.co/...</code> or Google Images pages will not display.
        </p>
        {imageUrlError && <p className="mt-1 text-sm text-red-700">{imageUrlError}</p>}
        {!imageUrlError && trimmedImageUrl && previewOk && (
          <div className="mt-3 rounded border border-black/10 bg-white p-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-black/50">Preview</p>
            <img
              src={trimmedImageUrl}
              alt="Product preview"
              className="h-40 w-full rounded object-contain bg-black/[0.02]"
              onError={() => setPreviewOk(false)}
            />
          </div>
        )}
        {!imageUrlError && trimmedImageUrl && !previewOk && (
          <p className="mt-2 text-sm text-amber-700">
            Preview could not be loaded. Double-check that the URL points directly to an image file.
          </p>
        )}
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
