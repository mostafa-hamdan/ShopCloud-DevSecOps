"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Header() {
  const { token, email, logout, isReady } = useAuth();

  return (
    <header className="border-b border-black/10 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          ShopCloud
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/" className="hover:text-accent">Shop</Link>
          {isReady && token ? (
            <>
              <Link href="/wishlist" className="hover:text-accent hidden sm:inline">Wishlist</Link>
              <Link href="/cart" className="hover:text-accent">Cart</Link>
              <Link href="/orders" className="hover:text-accent hidden sm:inline">Orders</Link>
              <Link href="/account" className="hover:text-accent hidden sm:inline">Account</Link>
              <span className="text-black/60 hidden lg:inline">{email}</span>
              <button onClick={logout} className="hover:text-accent">
                Sign out
              </button>
            </>
          ) : isReady ? (
            <>
              <Link href="/login" className="hover:text-accent">Sign in</Link>
              <Link
                href="/register"
                className="px-3 py-1.5 bg-ink text-white rounded hover:bg-black"
              >
                Sign up
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
