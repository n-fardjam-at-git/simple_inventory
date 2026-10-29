"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRoles, type Role } from "@/lib/auth";

const ROLES: Role[] = ["admin", "warehouse", "sales_rep", "customer", "vendor"];

export async function updateProfile(
  id: string,
  patch: {
    display_name: string;
    role: string;
    vendor_id: string;
    customer_id: string;
  },
) {
  const me = await requireRoles(["admin"]);
  const display_name = patch.display_name.trim();
  if (!display_name) return "Enter a name.";
  if (!ROLES.includes(patch.role as Role)) return "Pick a role.";
  const role = patch.role as Role;
  if (me.id === id && role !== "admin") return "Keep your own admin role.";

  let vendor_id: string | null = null;
  let customer_id: string | null = null;
  if (role === "vendor") {
    vendor_id = patch.vendor_id.trim() || null;
    if (!vendor_id) return "Pick a vendor.";
  } else if (role === "customer") {
    customer_id = patch.customer_id.trim() || null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name, role, vendor_id, customer_id })
    .eq("id", id);
  if (error) return error.message;
  revalidatePath("/users");
  return null;
}
