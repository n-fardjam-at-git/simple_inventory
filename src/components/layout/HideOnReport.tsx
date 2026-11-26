"use client";

import { usePathname } from "next/navigation";

/** A report opens in its own tab: an order, cutting, or shipment print page, or the shop preview. */
export function isReportPath(pathname: string | null) {
  if (!pathname) return false;
  return pathname === "/shop/preview" || /\/print\/?$/.test(pathname);
}

/** Leaves its children out on a report tab, so only the report and its own buttons show. */
export function HideOnReport({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isReportPath(pathname)) return null;
  return <>{children}</>;
}
