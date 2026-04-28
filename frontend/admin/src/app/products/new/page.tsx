"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categories as catApi, products as productsApi, Category } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";
import ProductForm, { ProductFormValues } from "@/components/ProductForm";

export default function NewProductPage() {
  const { token } = useAdminAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!token) return;
    catApi.list(token).then(setCategories).catch(() => { /* ok */ });
  }, [token]);

  async function submit(v: ProductFormValues) {
    if (!token) return;
    await productsApi.create(token, v);
    router.push("/products");
  }

  return (
    <div>
      <Link href="/products" className="text-sm text-accent hover:underline">← Products</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">New product</h1>
      <ProductForm categories={categories} submitLabel="Create product" onSubmit={submit} />
    </div>
  );
}
