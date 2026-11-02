"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { toSentenceCase } from "@/lib/text-case";

function revalidateCustomers(id?: string) {
  revalidatePath("/customers");
  revalidatePath("/customer-orders");
  revalidatePath("/customer-shipments");
  if (id) revalidatePath(`/customers/${id}`);
}

async function requireAdmin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") return "Only an admin can edit customers.";
  return null;
}

export type CustomerPatch = {
  companyName: string;
  businessName: string;
  accountNumber: string;
  contact: string;
  email: string;
  phone: string;
  cellPhone: string;
  paymentTermId: string;
  salesRepId: string;
  doNotShip: boolean;
  notes: string;
  isActive: boolean;
};

function optionalText(value: string) {
  const text = value.trim();
  return text || null;
}

async function salesRepId(id: string) {
  if (!id) return { id: null as string | null, error: null as string | null };
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, role").eq("id", id).maybeSingle();
  if (!data || data.role !== "sales_rep") return { id: null, error: "Pick a sales rep." };
  return { id: data.id, error: null };
}

function names(companyName: string, businessName: string) {
  const company = toSentenceCase(companyName.trim());
  const business = toSentenceCase(businessName.trim()) || company;
  return { company, business };
}

export async function createCustomer(patch: CustomerPatch) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { company, business } = names(patch.companyName, patch.businessName);
  if (!company) return "Enter a customer name.";
  const rep = await salesRepId(patch.salesRepId);
  if (rep.error) return rep.error;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    company_name: company,
    business_name: business,
    account_number: patch.accountNumber.trim() || null,
    sales_rep_id: rep.id,
    contact: toSentenceCase(patch.contact.trim()) || null,
    email: optionalText(patch.email),
    phone: optionalText(patch.phone),
    cell_phone: optionalText(patch.cellPhone),
    payment_term_id: patch.paymentTermId || null,
    do_not_ship: patch.doNotShip,
    notes: toSentenceCase(patch.notes.trim()) || null,
    is_active: patch.isActive,
  });
  if (error?.code === "23505") return "That Sage account is already used.";
  if (error) return error.message;
  revalidateCustomers();
}

export async function updateCustomerRow(id: string, patch: CustomerPatch) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { company, business } = names(patch.companyName, patch.businessName);
  if (!company) return "Enter a customer name.";
  const rep = await salesRepId(patch.salesRepId);
  if (rep.error) return rep.error;
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      company_name: company,
      business_name: business,
      account_number: patch.accountNumber.trim() || null,
      sales_rep_id: rep.id,
      contact: toSentenceCase(patch.contact.trim()) || null,
      email: optionalText(patch.email),
      phone: optionalText(patch.phone),
      cell_phone: optionalText(patch.cellPhone),
      payment_term_id: patch.paymentTermId || null,
      do_not_ship: patch.doNotShip,
      notes: toSentenceCase(patch.notes.trim()) || null,
      is_active: patch.isActive,
    })
    .eq("id", id);
  if (error?.code === "23505") return "That Sage account is already used.";
  if (error) return error.message;
  revalidateCustomers(id);
}

export async function deleteCustomer(id: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error?.code === "23503") return "This customer is still used on an order or a shipment.";
  if (error) return error.message;
  revalidateCustomers();
}

export async function updateCustomer(id: string, formData: FormData) {
  const denied = await requireAdmin();
  if (denied) throw new Error(denied);
  const { company, business } = names(
    String(formData.get("company_name") ?? ""),
    String(formData.get("business_name") ?? ""),
  );
  if (!company) throw new Error("Enter a customer name.");
  const sage = String(formData.get("account_number") || "").trim();
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      company_name: company,
      business_name: business,
      account_number: sage || null,
      contact: toSentenceCase(String(formData.get("contact") || "").trim()) || null,
      email: optionalText(String(formData.get("email") || "")),
      phone: optionalText(String(formData.get("phone") || "")),
      cell_phone: optionalText(String(formData.get("cell_phone") || "")),
      payment_term_id: String(formData.get("payment_term_id") || "") || null,
      do_not_ship: formData.get("do_not_ship") === "on",
      notes: toSentenceCase(String(formData.get("notes") || "").trim()) || null,
    })
    .eq("id", id);
  if (error?.code === "23505") throw new Error("That Sage account is already used.");
  if (error) throw new Error(error.message);
  revalidateCustomers(id);
}

export type AddressPatch = {
  addressType: string;
  locationName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

function addressValues(patch: AddressPatch) {
  const addressType = patch.addressType;
  if (addressType !== "shipping" && addressType !== "billing" && addressType !== "both") return null;
  return {
    address_type: addressType,
    location_name: toSentenceCase(patch.locationName.trim()) || null,
    address_line1: optionalText(patch.addressLine1),
    address_line2: optionalText(patch.addressLine2),
    city: toSentenceCase(patch.city.trim()) || null,
    region: optionalText(patch.region),
    postal_code: optionalText(patch.postalCode),
    country: optionalText(patch.country),
  };
}

export async function createAddress(customerId: string, patch: AddressPatch) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const values = addressValues(patch);
  if (!values) return "Choose shipping, billing, or both.";
  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").insert({
    customer_id: customerId,
    ...values,
  });
  if (error) return error.message;
  revalidateCustomers(customerId);
  return null;
}

export async function updateAddress(id: string, customerId: string, patch: AddressPatch) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const values = addressValues(patch);
  if (!values) return "Choose shipping, billing, or both.";
  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").update(values).eq("id", id);
  if (error) return error.message;
  revalidateCustomers(customerId);
  return null;
}

export async function deleteAddress(id: string, customerId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
  if (error?.code === "23503") return "This address is still used on an order or a shipment.";
  if (error) return error.message;
  revalidateCustomers(customerId);
  return null;
}

export async function addAddress(customerId: string, formData: FormData) {
  const message = await createAddress(customerId, {
    addressType: String(formData.get("address_type") || ""),
    locationName: String(formData.get("location_name") || ""),
    addressLine1: String(formData.get("address_line1") || ""),
    addressLine2: String(formData.get("address_line2") || ""),
    city: String(formData.get("city") || ""),
    region: String(formData.get("region") || ""),
    postalCode: String(formData.get("postal_code") || ""),
    country: String(formData.get("country") || ""),
  });
  if (message) throw new Error(message);
}
