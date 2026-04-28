"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/lib/auth-context";
import LoginScreen from "./LoginScreen";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { token, email, logout, isReady } = useAdminAuth();
  const pathname = usePathname();

  if (!isReady) return null;
  if (!token) return <LoginScreen />;

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/products", label: "Products" },
    { href: "/orders", label: "Orders" },
    { href: "/returns", label: "Returns" },
    { href: "/customers", label: "Customers" },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-950 text-white flex flex-col">
        <div className="px-4 py-5 border-b border-white/10">
          <p className="text-xs uppercase tracking-wider text-white/50">ShopCloud</p>
          <p className="font-semibold">Admin</p>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => {
            const active = pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 text-sm ${
                  active ? "bg-white/10 border-l-2 border-accent" : "hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-white/10 text-xs">
          <p className="text-white/60 truncate">{email}</p>
          <button
            onClick={logout}
            className="mt-1 text-white/80 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
