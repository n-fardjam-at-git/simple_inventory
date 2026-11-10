"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SHIP_AT_ONCE } from "@/lib/customer-order";
import { PRODUCT_TYPE } from "@/lib/product-type";
import { parseCellFields } from "@/lib/products";

function blank(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function customerContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, customerId: null as string | null, userId: null as string | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "customer") {
    return { supabase, customerId: null, userId: user.id };
  }
  let customerId = (profile.customer_id as string | null) ?? null;
  if (!customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    customerId = customer?.id ?? null;
  }
  return { supabase, customerId, userId: user.id };
}

async function merchandise(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase
    .from("products")
    .select("id, standard_price, type, is_active, published")
    .in("id", ids);
  return (data ?? []).filter(
    (product) =>
      product.type === PRODUCT_TYPE.merchandise &&
      product.is_active !== false &&
      product.published === true,
  );
}

async function addProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  productIds: string[],
) {
  const products = await merchandise(supabase, productIds);
  if (!products.length) return "Pick a product from the shop.";
  const { data: existing } = await supabase
    .from("customer_order_request_products")
    .select("product_id")
    .eq("request_id", requestId);
  const have = new Set((existing ?? []).map((row) => row.product_id));
  const fresh = products.filter((product) => !have.has(product.id));
  if (!fresh.length) return null;
  const { error } = await supabase.from("customer_order_request_products").insert(
    fresh.map((product) => ({
      request_id: requestId,
      product_id: product.id,
      price: Number(product.standard_price ?? 0),
    })),
  );
  return error?.message ?? null;
}

function addressFields(
  prefix: "ship" | "bill",
  row: {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
  } | null,
) {
  return {
    [`${prefix}_address_line1`]: row?.address_line1 ?? null,
    [`${prefix}_address_line2`]: row?.address_line2 ?? null,
    [`${prefix}_city`]: row?.city ?? null,
    [`${prefix}_region`]: row?.region ?? null,
    [`${prefix}_postal_code`]: row?.postal_code ?? null,
    [`${prefix}_country`]: row?.country ?? null,
  };
}

/** Creates a draft from the cart and returns its id, or an error message. */
export async function createRequestFromCart(productIds: string[]): Promise<string> {
  const { supabase, customerId, userId } = await customerContext();
  if (!userId) return "Sign in again.";
  if (!customerId) return "Your login is not linked to a customer.";
  const products = await merchandise(supabase, productIds);
  if (!products.length) return "Pick a product from the shop.";
  const { data: customer } = await supabase
    .from("customers")
    .select("id, sales_rep_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return "Your login is not linked to a customer.";
  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("address_type, address_line1, address_line2, city, region, postal_code, country")
    .eq("customer_id", customerId);
  const ship =
    (addresses ?? []).find((row) => row.address_type === "shipping" || row.address_type === "both") ??
    null;
  const bill =
    (addresses ?? []).find((row) => row.address_type === "billing" || row.address_type === "both") ??
    null;
  const { data: created, error } = await supabase
    .from("customer_order_requests")
    .insert({
      customer_id: customerId,
      status: "draft",
      future_season: SHIP_AT_ONCE,
      start_date: new Date().toISOString().slice(0, 10),
      sales_rep_id: customer.sales_rep_id,
      created_by: userId,
      ...addressFields("ship", ship),
      ...addressFields("bill", bill),
    })
    .select("id")
    .single();
  if (error || !created) return error?.message ?? "Could not start the order.";
  const message = await addProducts(
    supabase,
    created.id,
    products.map((product) => product.id),
  );
  if (message) return message;
  revalidatePath("/my-orders");
  return created.id;
}

/** Adds cart products onto a draft. Returns the request id, or an error message. */
export async function addCartToRequest(requestId: string, productIds: string[]): Promise<string> {
  const { supabase, customerId, userId } = await customerContext();
  if (!userId) return "Sign in again.";
  if (!customerId) return "Your login is not linked to a customer.";
  const { data: request } = await supabase
    .from("customer_order_requests")
    .select("id, status, customer_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.customer_id !== customerId || request.status !== "draft") {
    return "That order is not an open draft.";
  }
  const message = await addProducts(supabase, requestId, productIds);
  if (message) return message;
  revalidatePath("/my-orders");
  return requestId;
}

export async function saveRequestHeader(requestId: string, formData: FormData) {
  const { supabase, customerId } = await customerContext();
  if (!customerId) return "Your login is not linked to a customer.";
  const futureSeason = blank(formData.get("future_season"));
  if (futureSeason && futureSeason !== SHIP_AT_ONCE) {
    const { data: season } = await supabase
      .from("seasons")
      .select("season")
      .eq("season", futureSeason)
      .maybeSingle();
    if (!season) return "Pick a season.";
  }
  const shipId = String(formData.get("ship_address_id") || "");
  const billId = String(formData.get("bill_address_id") || "");
  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("id, address_type, address_line1, address_line2, city, region, postal_code, country")
    .eq("customer_id", customerId);
  const ship = shipId ? (addresses ?? []).find((row) => row.id === shipId) : null;
  const bill = billId ? (addresses ?? []).find((row) => row.id === billId) : null;
  if (shipId && (!ship || (ship.address_type !== "shipping" && ship.address_type !== "both"))) {
    return "Ship-to must be a shipping address.";
  }
  if (billId && (!bill || (bill.address_type !== "billing" && bill.address_type !== "both"))) {
    return "Bill-to must be a billing address.";
  }
  const patch: Record<string, unknown> = {
    future_season: futureSeason,
    start_date: blank(formData.get("start_date")),
    cancel_date: blank(formData.get("cancel_date")),
    notes: blank(formData.get("notes")),
  };
  if (formData.get("ship_set") === "1") Object.assign(patch, addressFields("ship", ship ?? null));
  if (formData.get("bill_set") === "1") Object.assign(patch, addressFields("bill", bill ?? null));
  const { error } = await supabase
    .from("customer_order_requests")
    .update(patch)
    .eq("id", requestId)
    .eq("customer_id", customerId)
    .eq("status", "draft");
  if (error) return error.message;
  revalidatePath("/my-orders");
}

export async function submitRequest(requestId: string) {
  const { supabase, customerId } = await customerContext();
  if (!customerId) return "Your login is not linked to a customer.";
  const { error } = await supabase
    .from("customer_order_requests")
    .update({ status: "submitted" })
    .eq("id", requestId)
    .eq("customer_id", customerId)
    .eq("status", "draft");
  if (error) return error.message;
  revalidatePath("/my-orders");
}

export async function deleteRequest(requestId: string) {
  const { supabase, customerId } = await customerContext();
  if (!customerId) return "Your login is not linked to a customer.";
  const { error } = await supabase
    .from("customer_order_requests")
    .delete()
    .eq("id", requestId)
    .eq("customer_id", customerId)
    .eq("status", "draft");
  if (error) return error.message;
  revalidatePath("/my-orders");
}

export async function saveRequestQty(requestId: string, productId: string, formData: FormData) {
  const { supabase, customerId } = await customerContext();
  if (!customerId) return "Your login is not linked to a customer.";
  const { data: line } = await supabase
    .from("customer_order_request_products")
    .select("product_id, customer_order_requests!inner(customer_id, status)")
    .eq("request_id", requestId)
    .eq("product_id", productId)
    .maybeSingle();
  const parent = (Array.isArray(line?.customer_order_requests)
    ? line?.customer_order_requests[0]
    : line?.customer_order_requests) as { customer_id: string; status: string } | null;
  if (!line || parent?.customer_id !== customerId || parent.status !== "draft") {
    return "That product is not on an open draft.";
  }
  const [{ data: sizeRows }, { data: dropRows }, { data: ups }] = await Promise.all([
    supabase.from("product_sizes").select("size_id").eq("product_id", productId),
    supabase.from("product_drops").select("drop_id").eq("product_id", productId),
    supabase
      .from("product_price_upcharges")
      .select("size_id, drop_id, upcharge_amount")
      .eq("product_id", productId),
  ]);
  const sizes = new Set((sizeRows ?? []).map((row) => row.size_id));
  const drops = new Set((dropRows ?? []).map((row) => row.drop_id));
  const upcharge = new Map(
    (ups ?? []).map((row) => [`${row.size_id}:${row.drop_id}`, Number(row.upcharge_amount ?? 0)]),
  );
  const cells = parseCellFields(formData, "qty").filter(
    (cell) => cell.qty > 0 && sizes.has(cell.size_id) && drops.has(cell.drop_id),
  );
  const { error: cleared } = await supabase
    .from("customer_order_request_cells")
    .delete()
    .eq("request_id", requestId)
    .eq("product_id", productId);
  if (cleared) return cleared.message;
  if (cells.length) {
    const { error } = await supabase.from("customer_order_request_cells").insert(
      cells.map((cell) => ({
        request_id: requestId,
        product_id: productId,
        size_id: cell.size_id,
        drop_id: cell.drop_id,
        qty: cell.qty,
        price: upcharge.get(`${cell.size_id}:${cell.drop_id}`) || null,
      })),
    );
    if (error) return error.message;
  }
  revalidatePath("/my-orders");
}

export async function removeRequestProduct(requestId: string, productId: string) {
  const { supabase, customerId } = await customerContext();
  if (!customerId) return "Your login is not linked to a customer.";
  const { error } = await supabase
    .from("customer_order_request_products")
    .delete()
    .eq("request_id", requestId)
    .eq("product_id", productId);
  if (error) return error.message;
  revalidatePath("/my-orders");
}
