import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "warehouse" | "sales_rep" | "customer" | "vendor";

export type Profile = {
  id: string;
  role: Role;
  display_name: string;
};

export async function getProfile(): Promise<Profile | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function requireUser() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRoles(roles: Role[]) {
  const profile = await requireUser();
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}

export function canSeeNav(role: Role, href: string) {
  if (role === "admin") return true;
  if (role === "vendor") {
    return (
      href === "/vendor-advices" ||
      href.startsWith("/vendor-advices/") ||
      href === "/vendor-cuttings" ||
      href.startsWith("/vendor-cuttings/")
    );
  }
  const warehouse = [
    "/",
    "/products",
    "/inventory",
    "/alerts",
    "/vendors",
    "/cutting-orders",
    "/vendor-shipments",
    "/customer-shipments",
    "/customers",
  ];
  const sales = ["/", "/products", "/inventory", "/alerts", "/customer-shipments", "/customers"];
  const customer = ["/", "/products", "/inventory", "/alerts"];
  if (role === "warehouse") return warehouse.some((p) => href === p || href.startsWith(p + "/"));
  if (role === "sales_rep") return sales.some((p) => href === p || href.startsWith(p + "/"));
  return customer.some((p) => href === p || href.startsWith(p + "/"));
}
