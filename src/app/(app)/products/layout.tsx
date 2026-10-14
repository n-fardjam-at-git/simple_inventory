"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageTitle } from "@/components/ui";

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const list = path === "/products" || path === "/products/charges";
  if (!list) return children;

  const merch = path === "/products";
  const charges = path === "/products/charges";

  return (
    <div>
      <PageTitle title="Products" className="mb-2" />
      <nav className="mb-3 flex gap-1">
        <Link
          href="/products"
          className={`rounded px-3 py-1.5 text-sm ${
            merch ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          Merchandise
        </Link>
        <Link
          href="/products/charges"
          className={`rounded px-3 py-1.5 text-sm ${
            charges ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          Charges & freight
        </Link>
      </nav>
      {children}
    </div>
  );
}
