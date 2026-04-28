import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "ShopCloud",
  description: "Lightweight e-commerce.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <Header />
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">{children}</main>
          <footer className="border-t border-black/10 mt-12 py-6 text-center text-xs text-black/50">
            ShopCloud · demo storefront
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
