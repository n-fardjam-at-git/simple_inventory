"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCustomer(formData: FormData) {
  const supabase = await createClient();
  const sage = String(formData.get("account_number") || "").trim();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_name: String(formData.get("company_name")),
      account_number: sage || null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message);
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createClient();
  const sage = String(formData.get("account_number") || "").trim();
  await supabase
    .from("customers")
    .update({
      company_name: String(formData.get("company_name")),
      account_number: sage || null,
    })
    .eq("id", id);
  revalidatePath(`/customers/${id}`);
}

export async function addAddress(customerId: string, formData: FormData) {
  const supabase = await createClient();
  await supabase.from("customer_addresses").insert({
    customer_id: customerId,
    address_type: String(formData.get("address_type")),
    label: String(formData.get("label") || "") || null,
    address_line1: String(formData.get("address_line1")),
    city: String(formData.get("city")),
    region: String(formData.get("region")),
    postal_code: String(formData.get("postal_code")),
    country: String(formData.get("country")),
  });
  revalidatePath(`/customers/${customerId}`);
}
