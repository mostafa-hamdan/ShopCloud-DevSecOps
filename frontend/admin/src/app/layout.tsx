import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "@/lib/auth-context";
import AdminShell from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "ShopCloud Admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminAuthProvider>
          <AdminShell>{children}</AdminShell>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
