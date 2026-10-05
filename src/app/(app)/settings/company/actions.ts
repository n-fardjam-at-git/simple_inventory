"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveCompany(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("company_profile")
    .update({
      legal_name: String(formData.get("legal_name")),
      trade_name: String(formData.get("trade_name")),
      address_line1: String(formData.get("address_line1")),
      address_line2: String(formData.get("address_line2")),
      city: String(formData.get("city")),
      region: String(formData.get("region")),
      postal_code: String(formData.get("postal_code")),
      country: String(formData.get("country")),
      tax_id: String(formData.get("tax_id")),
      notes: String(formData.get("notes")),
    })
    .eq("id", "00000000-0000-0000-0000-000000000001");
  revalidatePath("/settings/company");
}

export async function addContact(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("company_contacts").insert({
    company_profile_id: "00000000-0000-0000-0000-000000000001",
    kind: String(formData.get("kind")),
    label: String(formData.get("label")),
    value: String(formData.get("value")),
    is_primary: formData.get("is_primary") === "on",
  });
  revalidatePath("/settings/company");
}
