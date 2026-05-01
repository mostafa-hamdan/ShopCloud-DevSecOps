"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { catalog, cart as cartApi, Product, Review, reviews as reviewsApi, wishlist as wishlistApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/money";

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, userId } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [wishBusy, setWishBusy] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!params?.id) return;
    try {
      setReviews(await reviewsApi.list(params.id));
    } catch { /* non-fatal */ }
  }, [params?.id]);

  useEffect(() => {
    if (!params?.id) return;
    catalog.get(params.id).then(setProduct).catch((e) => setError(e.message));
    loadReviews();
  }, [params?.id, loadReviews]);

  async function addToCart() {
    if (!token) { router.push(`/login?next=/products/${params?.id}`); return; }
    if (!product) return;
    setBusy(true); setError(null);
    try {
      await cartApi.add(token, product.id, qty);
      setAdded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add to cart");
    } finally { setBusy(false); }
  }

  async function addToWishlist() {
    if (!token) { router.push(`/login?next=/products/${params?.id}`); return; }
    if (!product) return;
    setWishBusy(true);
    try {
      await wishlistApi.add(token, product.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add to wishlist");
    } finally { setWishBusy(false); }
  }

  if (error && !product) return <p className="text-red-700">{error}</p>;
  if (!product) return <p className="text-black/60">Loading…</p>;

  const outOfStock = product.stock <= 0;

  return (
    <div className="space-y-12">
      <div className="grid md:grid-cols-2 gap-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="aspect-[4/3] rounded border border-black/10 bg-[#f7f5f0] flex items-center justify-center overflow-hidden">
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-contain p-5"
          />
        </div>
        <div>
          <p className="text-sm text-black/50">{product.category?.name ?? "—"}</p>
          <h1 className="text-3xl font-semibold mt-1">{product.name}</h1>

          {product.rating_count > 0 && (
            <div className="mt-2 text-sm text-black/60">
              ★ {product.rating_avg.toFixed(1)}
              <span className="text-black/40"> ({product.rating_count} review{product.rating_count === 1 ? "" : "s"})</span>
            </div>
          )}

          <p className="text-2xl font-semibold mt-3">
            {formatMoney(product.price_cents, product.currency)}
          </p>
          <p className="mt-4 text-black/70 leading-relaxed">{product.description}</p>

          <div className="mt-6 flex items-center gap-3">
            <label htmlFor="qty" className="text-sm text-black/60">Qty</label>
            <input
              id="qty" type="number" min={1}
              max={Math.max(1, product.stock)}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={outOfStock}
              className="w-20 px-2 py-1.5 border border-black/15 rounded bg-white"
            />
            <span className="text-sm text-black/50">
              {outOfStock ? "Out of stock" : `${product.stock} in stock`}
            </span>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={addToCart}
              disabled={busy || outOfStock}
              className="px-5 py-2.5 bg-ink text-white rounded hover:bg-black disabled:bg-black/30"
            >
              {busy ? "Adding…" : added ? "Added — add another?" : "Add to cart"}
            </button>
            <button
              onClick={addToWishlist}
              disabled={wishBusy}
              className="px-5 py-2.5 border border-black/15 rounded hover:border-accent disabled:opacity-50"
            >
              ♡ Wishlist
            </button>
          </div>

          {error && <p className="text-red-700 mt-3 text-sm">{error}</p>}
        </div>
      </div>

      <ReviewsSection
        productId={product.id}
        reviews={reviews}
        token={token}
        currentUserId={userId}
        onChanged={loadReviews}
      />
    </div>
  );
}

function ReviewsSection({
  productId, reviews, token, currentUserId, onChanged,
}: {
  productId: string; reviews: Review[]; token: string | null;
  currentUserId: string | null; onChanged: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setErr(null);
    try {
      await reviewsApi.create(token, productId, rating, title, body);
      setTitle(""); setBody(""); setRating(5);
      onChanged();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(reviewId: string) {
    if (!token) return;
    try {
      await reviewsApi.remove(token, productId, reviewId);
      onChanged();
    } catch { /* ignore */ }
  }

  const myReview = currentUserId
    ? reviews.find((r) => r.user_id === currentUserId)
    : undefined;

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Reviews</h2>

      {token && !myReview && (
        <form onSubmit={submit} className="mb-6 p-4 bg-white border border-black/10 rounded space-y-3">
          <div className="flex items-center gap-2">
            {[1,2,3,4,5].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setRating(n)}
                className={`text-2xl leading-none ${n <= rating ? "text-amber-500" : "text-black/20"}`}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
              >★</button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Headline (optional)"
            maxLength={140}
            className="w-full px-3 py-2 border border-black/15 rounded"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts (optional)"
            rows={3}
            className="w-full px-3 py-2 border border-black/15 rounded"
          />
          {err && <p className="text-red-700 text-sm">{err}</p>}
          <button
            disabled={submitting}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-emerald-800 disabled:bg-black/30"
          >
            {submitting ? "Posting…" : "Post review"}
          </button>
        </form>
      )}

      {!token && (
        <p className="mb-6 text-sm text-black/60">
          Sign in to leave a review.
        </p>
      )}

      {reviews.length === 0 && (
        <p className="text-black/50">No reviews yet.</p>
      )}

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="p-4 bg-white border border-black/10 rounded">
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                {r.title && <p className="font-medium mt-1">{r.title}</p>}
                <p className="text-xs text-black/50 mt-0.5">
                  {r.user_email} · {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              {currentUserId === r.user_id && (
                <button
                  onClick={() => remove(r.id)}
                  className="text-xs text-black/50 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
            {r.body && <p className="mt-2 text-sm text-black/80 whitespace-pre-wrap">{r.body}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
