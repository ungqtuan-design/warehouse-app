import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Boxes, ClipboardList, LayoutGrid, Package, ShoppingBasket, Truck } from "lucide-react";

export const metadata: Metadata = {
  title: "Warehouse App",
  description: "Warehouse management system for kho tong and kho le",
};

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/products", label: "Products", icon: Package },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/inbound", label: "Inbound", icon: Boxes },
  { href: "/inventory", label: "Inventory", icon: ClipboardList },
  { href: "/basket", label: "Basket", icon: ShoppingBasket },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-100 text-slate-900">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <aside className="border-b border-slate-200 bg-slate-950 text-slate-50 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-800 px-6 py-6">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Wiings</p>
              <h1 className="mt-2 text-2xl font-semibold">Warehouse Control</h1>
              <p className="mt-2 text-sm text-slate-400">Neon-backed stock flow for kho tong and kho le.</p>
            </div>
            <nav className="grid gap-1 px-3 py-4">
              {navigation.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-900 hover:text-white"
                >
                  <Icon className="h-4 w-4 text-cyan-300" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </aside>
          <div className="flex min-h-screen flex-1 flex-col">
            <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Warehouse MVP</p>
                  <h2 className="text-xl font-semibold">Operations workspace</h2>
                </div>
                <div className="rounded-full bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-900">
                  Locations: kho tong, kho le
                </div>
              </div>
            </header>
            <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
