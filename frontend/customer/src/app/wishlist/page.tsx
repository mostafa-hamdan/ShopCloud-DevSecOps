"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cart as cartApi, Wishlist, wishlist as wishlistApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";

export default function WishlistPage() {
  const { token, isReady } = useAuth();
  const router = useRouter();
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try { setWishlist(await wishlistApi.get(token)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
  }, [token]);

  useEffect(() => {
    if (!isReady) return;
    if (!token) { router.push("/login?next=/wishlist"); return; }
    load();
  }, [isReady, token, router, load]);

  async function moveToCart(productId: string) {
    if (!token) return;
    await cartApi.add(token, productId, 1);
    await wishlistApi.remove(token, productId);
    load();
  }

  async function remove(productId: string) {
    if (!token) return;
    await wishlistApi.remove(token, productId);
    load();
  }

  if (!isReady || !token) return null;
  if (error) return <p className="text-red-700">{error}</p>;
  if (!wishlist) return <p className="text-black/60">Loading…</p>;

  if (wishlist.items.length === 0) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-semibold mb-3">Your wishlist is empty</h1>
        <p className="text-black/60 mb-4">
          Save items for later by tapping the wishlist button on a product.
        </p>
        <Link href="/" className="text-accent hover:underline">Browse products</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">Your wishlist</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {wishlist.items.map((item) => (
          <div
            key={item.product_id}
            className="bg-white border border-black/10 rounded overflow-hidden flex flex-col"
          >
            <Link href={`/products/${item.product_id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="aspect-[3/2] bg-[#f7f5f0] border-b border-black/5 flex items-center justify-center">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-full w-full object-contain p-3"
                />
              </div>
            </Link>
            <div className="p-3 flex-1 flex flex-col">
              <Link href={`/products/${item.product_id}`}
                    className="font-medium leading-tight hover:text-accent">
                {item.name}
              </Link>
              <p className="mt-1 font-semibold">
                {formatMoney(item.price_cents, item.currency)}
              </p>
              <div className="mt-auto pt-3 flex gap-2">
                <button
                  onClick={() => moveToCart(item.product_id)}
                  disabled={item.stock <= 0}
                  className="flex-1 px-2 py-1.5 text-sm bg-ink text-white rounded hover:bg-black disabled:bg-black/30"
                >
                  {item.stock <= 0 ? "Out" : "To cart"}
                </button>
                <button
                  onClick={() => remove(item.product_id)}
                  className="px-2 py-1.5 text-sm border border-black/15 rounded hover:border-red-500"
                  aria-label="Remove"
                >×</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
