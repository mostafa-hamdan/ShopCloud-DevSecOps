"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { catalog, Category, Product } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalog.categories().then(setCategories).catch(() => { /* non-fatal */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    catalog
      .list(search || undefined, activeCategory, 24)
      .then((r) => { if (!cancelled) setProducts(r.items); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, activeCategory]);

  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Shop everything</h1>
        <p className="text-black/60">Browse the catalog. Add things you like to your cart.</p>
      </section>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="flex-1 px-3 py-2 border border-black/15 rounded bg-white focus:outline-none focus:border-accent"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveCategory(undefined)}
            className={`px-3 py-1.5 text-sm rounded border ${
              !activeCategory ? "bg-ink text-white border-ink" : "border-black/15 hover:border-accent"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.slug)}
              className={`px-3 py-1.5 text-sm rounded border ${
                activeCategory === c.slug
                  ? "bg-ink text-white border-ink"
                  : "border-black/15 hover:border-accent"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-700 mb-4">Could not load products: {error}</p>}
      {loading && <p className="text-black/60">Loading…</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.id}`}
            className="group bg-white border border-black/10 rounded overflow-hidden hover:border-accent transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt={p.name} className="w-full aspect-[3/2] object-cover" />
            <div className="p-3">
              <p className="text-sm text-black/50">{p.category?.name ?? "—"}</p>
              <h3 className="font-medium leading-tight group-hover:text-accent">{p.name}</h3>
              <p className="mt-1 font-semibold">{formatMoney(p.price_cents, p.currency)}</p>
            </div>
          </Link>
        ))}
      </div>

      {!loading && products.length === 0 && !error && (
        <p className="text-black/60 mt-8">No products match your search.</p>
      )}
    </div>
  );
}
