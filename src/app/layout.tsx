import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Boxes, ClipboardList, LayoutGrid, LogOut, Package, ShieldUser, ShoppingBasket, Truck } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { setLanguageAction, setThemeAction } from "@/app/actions/preferences";
import { getCurrentUser } from "@/lib/auth";
import { getUiContext } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Warehouse App",
  description: "Warehouse management system for kho tong and kho le",
};

const baseNavigation = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/products", label: "Products", icon: Package },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/inbound", label: "Inbound", icon: Boxes },
  { href: "/inventory", label: "Inventory", icon: ClipboardList },
  { href: "/basket", label: "Basket", icon: ShoppingBasket },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const { language, theme, text } = await getUiContext();

  if (!user) {
    return (
      <html lang={language} className="h-full">
        <body className={`theme-${theme} min-h-full bg-slate-950 text-slate-50`}>
          <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">{children}</main>
        </body>
      </html>
    );
  }

  const baseNavigation = [
    { href: "/", label: text.dashboard, icon: LayoutGrid },
    { href: "/products", label: text.products, icon: Package },
    { href: "/suppliers", label: text.suppliers, icon: Truck },
    { href: "/inbound", label: text.inbound, icon: Boxes },
    { href: "/inventory", label: text.inventory, icon: ClipboardList },
    { href: "/basket", label: text.basket, icon: ShoppingBasket },
  ];

  const navigation = user.role === "ADMIN"
    ? [...baseNavigation, { href: "/manage-users", label: text.manageUsers, icon: ShieldUser }]
    : baseNavigation;

  return (
    <html lang={language} className="h-full">
      <body className={`theme-${theme} min-h-full bg-slate-100 text-slate-900`}>
        <div className="min-h-screen lg:grid lg:grid-cols-[18rem_1fr]">
          <aside className="border-b border-slate-200 bg-slate-950 text-slate-50 lg:min-h-screen lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-800 px-4 py-5 sm:px-6 sm:py-6">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Wiings</p>
              <h1 className="mt-2 text-2xl font-semibold">{text.appTitle}</h1>
              <p className="mt-2 text-sm text-slate-400">{text.appDescription}</p>
            </div>
            <nav className="flex gap-2 overflow-x-auto px-3 py-4 lg:grid lg:gap-1 lg:overflow-visible">
              {navigation.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-w-[140px] flex-none items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-900 hover:text-white lg:min-w-0"
                >
                  <Icon className="h-4 w-4 text-cyan-300" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </aside>
          <div className="flex min-h-screen min-w-0 flex-col">
            <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Wiings</p>
                  <h2 className="text-xl font-semibold">{text.workspaceLabel}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                    {text.signedInAs} {user.username}
                  </div>
                  <div className="rounded-full bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-900">
                    {user.role === "ADMIN" ? text.admin : text.operation}
                  </div>
                  <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                    {text.locationsLabel}: {text.khoTong}, {text.khoLe}
                  </div>
                  <form action={setThemeAction} className="flex overflow-hidden rounded-full border border-slate-300">
                    <input type="hidden" name="theme" value={theme === "dark" ? "light" : "dark"} />
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                      {theme === "dark" ? text.lightMode : text.darkMode}
                    </button>
                  </form>
                  <form action={setLanguageAction} className="flex overflow-hidden rounded-full border border-slate-300">
                    <input type="hidden" name="language" value={language === "en" ? "vi" : "en"} />
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                      {language === "en" ? text.vietnamese : text.english}
                    </button>
                  </form>
                  <form action={logoutAction}>
                    <button type="submit" className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                      <LogOut className="h-4 w-4" />
                      {text.signOut}
                    </button>
                  </form>
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
