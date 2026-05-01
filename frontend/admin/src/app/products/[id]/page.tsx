"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { categories as catApi, products as productsApi, Category, Product } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";
import ProductForm, { ProductFormValues } from "@/components/ProductForm";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAdminAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !params?.id) return;
    Promise.all([
      productsApi.get(token, params.id),
      catApi.list(token),
    ])
      .then(([p, cs]) => {
        setProduct(p);
        setCategories(cs);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load product");
      });
  }, [token, params?.id]);

  async function submit(v: ProductFormValues) {
    if (!token || !product) return;
    await productsApi.update(token, product.id, {
      name: v.name,
      description: v.description,
      price_cents: v.price_cents,
      image_url: v.image_url,
      stock: v.stock,
      category_slug: v.category_slug,
    });
    router.push("/products");
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!product) return <p className="text-black/60">Loading...</p>;

  return (
    <div>
      <Link href="/products" className="text-sm text-accent hover:underline">← Products</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">Edit {product.name}</h1>
      <ProductForm
        initial={{
          sku: product.sku,
          name: product.name,
          description: product.description,
          price_cents: product.price_cents,
          currency: product.currency,
          image_url: product.image_url,
          stock: product.stock,
          category_slug: product.category?.slug,
        }}
        categories={categories}
        submitLabel="Save changes"
        onSubmit={submit}
        lockSku
      />
    </div>
  );
}
