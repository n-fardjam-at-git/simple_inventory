"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { toSentenceCase } from "@/lib/text-case";

function revalidateVendors() {
  revalidatePath("/vendors");
  revalidatePath("/users");
  revalidatePath("/vendor-advices");
  revalidatePath("/vendor-shipments");
  revalidatePath("/cutting-orders");
}

async function requireAdmin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") return "Only an admin can edit vendors.";
  return null;
}

export async function updateVendor(
  id: string,
  values: { name: string; notes: string; is_active: boolean },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const name = toSentenceCase(values.name.trim());
  if (!name) return "Enter a vendor name.";
  const notes = toSentenceCase(values.notes.trim()) || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("vendors")
    .update({ name, notes, is_active: values.is_active })
    .eq("id", id);
  if (error) return error.message;
  revalidateVendors();
  return null;
}

export async function deleteVendor(id: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) return error.message;
  revalidateVendors();
  return null;
}
