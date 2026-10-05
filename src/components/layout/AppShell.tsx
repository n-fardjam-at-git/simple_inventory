import Link from "next/link";
import type { Role } from "@/lib/auth";

const LINKS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/", label: "Dashboard", roles: ["admin", "warehouse", "sales_rep", "customer"] },
  { href: "/products", label: "Products", roles: ["admin", "warehouse", "sales_rep", "customer"] },
  { href: "/alerts", label: "Alerts", roles: ["admin", "warehouse", "sales_rep", "customer"] },
  { href: "/cutting-orders", label: "Cutting orders", roles: ["admin", "warehouse"] },
  { href: "/customer-shipments", label: "Customer shipments", roles: ["admin", "warehouse", "sales_rep"] },
  { href: "/customers", label: "Customers", roles: ["admin", "warehouse", "sales_rep"] },
  { href: "/vendors", label: "Vendors", roles: ["admin", "warehouse"] },
  { href: "/brands", label: "Brands", roles: ["admin"] },
  { href: "/items", label: "Items", roles: ["admin"] },
  { href: "/models", label: "Models", roles: ["admin"] },
  { href: "/lots", label: "Lots", roles: ["admin"] },
  { href: "/size-charts", label: "Size charts", roles: ["admin"] },
  { href: "/import-templates", label: "Import templates", roles: ["admin"] },
  { href: "/import", label: "Import", roles: ["admin"] },
  { href: "/settings/company", label: "Company", roles: ["admin"] },
];

export function AppShell({
  tradeName,
  displayName,
  role,
  children,
}: {
  tradeName: string;
  displayName: string;
  role: Role;
  children: React.ReactNode;
}) {
  const links = LINKS.filter((l) => l.roles.includes(role));
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-lg font-semibold tracking-tight">{tradeName}</p>
            <p className="text-xs text-stone-500">Wholesale inventory</p>
          </div>
          <form action="/logout" method="post" className="text-sm text-stone-600">
            <span className="mr-3">
              {displayName} · {role.replace("_", " ")}
            </span>
            <button className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-100" type="submit">
              Sign out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-1 px-4 pb-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded px-2 py-1 text-sm text-stone-700 hover:bg-stone-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
