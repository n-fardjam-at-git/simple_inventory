"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { ONLINE_BY_SALES_REP, SHIP_AT_ONCE, shipmentMethodLabel } from "@/lib/customer-order";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function revalidate() {
  revalidatePath("/draft-orders");
  revalidatePath("/customer-orders");
  revalidatePath("/my-orders");
}

function blank(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

type AddressRow = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
};

function addressFields(prefix: "ship" | "bill", row: AddressRow | null) {
  return {
    [`${prefix}_address_line1`]: row?.address_line1 ?? null,
    [`${prefix}_address_line2`]: row?.address_line2 ?? null,
    [`${prefix}_city`]: row?.city ?? null,
    [`${prefix}_region`]: row?.region ?? null,
    [`${prefix}_postal_code`]: row?.postal_code ?? null,
    [`${prefix}_country`]: row?.country ?? null,
  };
}

/** Null is no address. Undefined is an address that does not fit this customer. */
async function addressFor(supabase: Supabase, id: string, customerId: string, kinds: string[]) {
  if (!id) return null;
  const { data } = await supabase
    .from("customer_addresses")
    .select("customer_id, address_type, address_line1, address_line2, city, region, postal_code, country")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.customer_id !== customerId || !kinds.includes(data.address_type)) {
    return undefined;
  }
  return data;
}

/** The customer, when the signed-in sales rep services it. */
async function repCustomer(supabase: Supabase, customerId: string, repId: string) {
  const { data } = await supabase
    .from("customers")
    .select("id, sales_rep_id, user_id")
    .eq("id", customerId)
    .maybeSingle();
  return data && data.sales_rep_id === repId ? data : null;
}

async function customerHasLogin(supabase: Supabase, customer: { id: string; user_id: string | null }) {
  if (customer.user_id) return true;
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "customer")
    .eq("customer_id", customer.id);
  return (count ?? 0) > 0;
}

type KeptHeader = {
  terms: string | null;
  shipment_method_id: string | null;
  shipping_method: string | null;
};

/** Season, dates, terms, shipping method, addresses, and notes from the proposal card. */
async function proposalFields(
  supabase: Supabase,
  formData: FormData,
  customerId: string,
  kept: KeptHeader | null,
): Promise<{ error: string } | { patch: Record<string, unknown> }> {
  const shipKeep = kept != null && formData.get("ship_keep") === "1";
  const billKeep = kept != null && formData.get("bill_keep") === "1";
  const ship = shipKeep
    ? null
    : await addressFor(supabase, String(formData.get("ship_address_id") || ""), customerId, [
        "shipping",
        "both",
      ]);
  const bill = billKeep
    ? null
    : await addressFor(supabase, String(formData.get("bill_address_id") || ""), customerId, [
        "billing",
        "both",
      ]);
  if (ship === undefined) return { error: "Ship-to must be a shipping address for this customer." };
  if (bill === undefined) return { error: "Bill-to must be a billing address for this customer." };

  const futureSeason = blank(formData.get("future_season"));
  if (futureSeason && futureSeason !== SHIP_AT_ONCE) {
    const { data: season } = await supabase
      .from("seasons")
      .select("season")
      .eq("season", futureSeason)
      .maybeSingle();
    if (!season) return { error: "Pick a season." };
  }

  const startDate = blank(formData.get("start_date"));
  const deliverBy = blank(formData.get("cancel_date"));
  if (startDate && deliverBy && deliverBy < startDate) {
    return { error: "Deliver by must be on or after the start date." };
  }

  const terms = blank(formData.get("terms"));
  if (terms && terms !== kept?.terms) {
    const { data: term } = await supabase
      .from("payment_terms")
      .select("term")
      .eq("term", terms)
      .maybeSingle();
    if (!term) return { error: "Pick a term." };
  }

  let shipmentMethodId = blank(formData.get("shipment_method_id"));
  let shippingMethod: string | null = null;
  if (kept != null && formData.get("method_keep") === "1") {
    shipmentMethodId = kept.shipment_method_id;
    shippingMethod = kept.shipping_method;
  } else if (shipmentMethodId) {
    const { data: method } = await supabase
      .from("shipment_methods")
      .select("id, shipper, method")
      .eq("id", shipmentMethodId)
      .maybeSingle();
    if (!method) return { error: "Pick a shipping method." };
    shippingMethod = shipmentMethodLabel(method);
  }

  const patch: Record<string, unknown> = {
    future_season: futureSeason,
    start_date: startDate,
    cancel_date: deliverBy,
    terms,
    shipment_method_id: shipmentMethodId,
    shipping_method: shippingMethod,
    notes: blank(formData.get("notes")),
  };
  if (!shipKeep) Object.assign(patch, addressFields("ship", ship));
  if (!billKeep) Object.assign(patch, addressFields("bill", bill));
  return { patch };
}

/** A sales rep starts a draft proposal for a customer they service. */
export async function createProposal(formData: FormData): Promise<{ id?: string; error?: string }> {
  const profile = await requireRoles(["sales_rep"]);
  const supabase = await createClient();
  const customerId = String(formData.get("customer_id") || "");
  if (!customerId) return { error: "Pick a customer." };
  const customer = await repCustomer(supabase, customerId, profile.id);
  if (!customer) return { error: "Pick one of your customers." };
  const header = await proposalFields(supabase, formData, customerId, null);
  if ("error" in header) return { error: header.error };
  const { error } = await supabase.from("customer_order_requests").insert({
    customer_id: customerId,
    status: "draft",
    transmission_method: ONLINE_BY_SALES_REP,
    sales_rep_id: profile.id,
    created_by: profile.id,
    ...header.patch,
  });
  if (error) return { error: error.message };
  // A returning insert is checked by the read policy before the row exists, so read it after.
  const { data: created, error: readError } = await supabase
    .from("customer_order_requests")
    .select("id")
    .eq("customer_id", customerId)
    .eq("status", "draft")
    .eq("created_by", profile.id)
    .order("request_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError || !created) return { error: readError?.message ?? "Could not start the proposal." };
  revalidate();
  return { id: created.id };
}

/** The draft a sales rep entered, when that rep still services the customer. */
async function repDraft(supabase: Supabase, id: string, repId: string) {
  const { data: request } = await supabase
    .from("customer_order_requests")
    .select("id, status, customer_id, transmission_method, terms, shipment_method_id, shipping_method")
    .eq("id", id)
    .maybeSingle();
  if (!request || request.status !== "draft") return null;
  const customer = await repCustomer(supabase, request.customer_id, repId);
  return customer ? { request, customer } : null;
}

export async function saveProposalHeader(id: string, formData: FormData) {
  const profile = await requireRoles(["sales_rep"]);
  const supabase = await createClient();
  const found = await repDraft(supabase, id, profile.id);
  if (!found || found.request.transmission_method !== ONLINE_BY_SALES_REP) {
    return "That proposal can no longer be changed.";
  }
  const header = await proposalFields(supabase, formData, found.request.customer_id, found.request);
  if ("error" in header) return header.error;
  const { error } = await supabase
    .from("customer_order_requests")
    .update(header.patch)
    .eq("id", id)
    .eq("status", "draft");
  if (error) return error.message;
  revalidate();
  return null;
}

/** For a customer with no login: the sales rep submits and records the prices as accepted. */
export async function submitProposal(id: string) {
  const profile = await requireRoles(["sales_rep"]);
  const supabase = await createClient();
  const found = await repDraft(supabase, id, profile.id);
  if (!found) return "That proposal can no longer be changed.";
  if (await customerHasLogin(supabase, found.customer)) {
    return "This customer sends the order from My orders.";
  }
  const { error } = await supabase
    .from("customer_order_requests")
    .update({ status: "submitted", customer_acceptance: true })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return error.message;
  revalidate();
  return null;
}

export async function deleteProposal(id: string) {
  const profile = await requireRoles(["sales_rep"]);
  const supabase = await createClient();
  const found = await repDraft(supabase, id, profile.id);
  if (!found || found.request.transmission_method !== ONLINE_BY_SALES_REP) {
    return "Only a draft entered by a sales rep can be deleted.";
  }
  const { error } = await supabase
    .from("customer_order_requests")
    .delete()
    .eq("id", id)
    .eq("status", "draft");
  if (error) return error.message;
  revalidate();
  return null;
}

export async function acceptOrderRequest(id: string) {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_customer_order_request", { p_request_id: id });
  if (error) return error.message;
  revalidate();
  return null;
}

export async function saveOrderHandling(
  id: string,
  terms: string,
  shipmentMethodId: string,
  salesRepId: string,
) {
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_request_handling", {
    p_request_id: id,
    p_terms: terms,
    p_shipment_method_id: shipmentMethodId || null,
    p_sales_rep_id: salesRepId || null,
  });
  if (error) return error.message;
  revalidate();
  return null;
}

export async function saveStaffReply(id: string, reply: string) {
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_request_staff_reply", {
    p_request_id: id,
    p_reply: reply,
  });
  if (error) return error.message;
  revalidate();
  return null;
}

export async function returnOrderRequest(id: string) {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_customer_order_request", { p_request_id: id });
  if (error) return error.message;
  revalidate();
  return null;
}
