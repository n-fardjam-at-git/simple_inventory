"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCommissionPercent, SHIP_AT_ONCE, shipmentMethodLabel, WORKFLOW_STATUS } from "@/lib/customer-order";

function blank(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function staffId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

async function addressFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  customerId: string,
  kinds: string[],
) {
  if (!id) return null;
  const { data } = await supabase
    .from("customer_addresses")
    .select(
      "customer_id, address_type, address_line1, address_line2, city, region, postal_code, country",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data || data.customer_id !== customerId || !kinds.includes(data.address_type)) {
    return undefined;
  }
  return data;
}

async function chosenMethods(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
) {
  const shipmentId = blank(formData.get("shipment_method_id"));
  const transmissionId = blank(formData.get("transmission_method_id"));
  let shipping_method: string | null = null;
  let transmission_method: string | null = null;
  if (shipmentId) {
    const { data } = await supabase
      .from("shipment_methods")
      .select("id, shipper, method")
      .eq("id", shipmentId)
      .maybeSingle();
    if (!data) return { error: "Pick a shipping method." as const };
    shipping_method = shipmentMethodLabel(data);
  }
  if (transmissionId) {
    const { data } = await supabase
      .from("transmission_methods")
      .select("id, name")
      .eq("id", transmissionId)
      .maybeSingle();
    if (!data) return { error: "Pick how the order was received." as const };
    transmission_method = data.name;
  }
  return {
    error: null,
    shipment_method_id: shipmentId,
    transmission_method_id: transmissionId,
    shipping_method,
    transmission_method,
  };
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

export async function createCustomerOrder(formData: FormData) {
  const { supabase, userId } = await staffId();
  const customerId = String(formData.get("customer_id") || "");
  if (!customerId) return "Pick a customer.";
  const ship = await addressFor(
    supabase,
    String(formData.get("ship_address_id") || ""),
    customerId,
    ["shipping", "both"],
  );
  const bill = await addressFor(
    supabase,
    String(formData.get("bill_address_id") || ""),
    customerId,
    ["billing", "both"],
  );
  if (ship === undefined) return "Ship-to must be a shipping address for this customer.";
  if (bill === undefined) return "Bill-to must be a billing address for this customer.";
  const methods = await chosenMethods(supabase, formData);
  if (methods.error) return methods.error;
  const futureSeason = blank(formData.get("future_season"));
  if (futureSeason && futureSeason !== SHIP_AT_ONCE) {
    const { data: season } = await supabase
      .from("seasons")
      .select("season")
      .eq("season", futureSeason)
      .maybeSingle();
    if (!season) return "Pick a season.";
  }
  const { data: customer } = await supabase
    .from("customers")
    .select("sales_rep_id, payment_terms ( term )")
    .eq("id", customerId)
    .maybeSingle();
  const termJoin = customer?.payment_terms as { term: string } | { term: string }[] | null;
  const termName = Array.isArray(termJoin) ? termJoin[0]?.term : termJoin?.term;
  const { error } = await supabase.from("customer_orders").insert({
    customer_id: customerId,
    start_date: blank(formData.get("start_date")),
    cancel_date: blank(formData.get("cancel_date")),
    future_season: futureSeason,
    shipment_method_id: methods.shipment_method_id,
    shipping_method: methods.shipping_method,
    transmission_method_id: methods.transmission_method_id,
    transmission_method: methods.transmission_method,
    terms: termName ?? null,
    sales_rep_id: customer?.sales_rep_id ?? null,
    created_by: userId,
    updated_by: userId,
    ...addressFields("ship", ship),
    ...addressFields("bill", bill),
  });
  if (error) return error.message;
  revalidatePath("/customer-orders");
}

export async function updateCustomerOrderRow(
  id: string,
  patch: { customerId: string; startDate: string; status: string | null },
) {
  const { supabase, userId } = await staffId();
  if (!patch.customerId) return "Pick a customer.";
  const { data: customer } = await supabase
    .from("customers")
    .select("id, sales_rep_id")
    .eq("id", patch.customerId)
    .maybeSingle();
  if (!customer) return "Pick a customer.";
  const next: Record<string, unknown> = {
    customer_id: patch.customerId,
    sales_rep_id: customer.sales_rep_id,
    start_date: patch.startDate.trim() || null,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (patch.status) {
    if (!WORKFLOW_STATUS.includes(patch.status as (typeof WORKFLOW_STATUS)[number])) {
      return "That status is set from the product lines.";
    }
    const { data: lines } = await supabase
      .from("customer_order_products")
      .select("status")
      .eq("customer_order_id", id);
    const blocking = (lines ?? []).some(
      (line) => line.status !== "pending" && line.status !== "canceled",
    );
    if (blocking) {
      return "Approved and Picking stay only while every open line is pending.";
    }
    next.status = patch.status;
  }
  const { error } = await supabase.from("customer_orders").update(next).eq("id", id);
  if (error) return error.message;
  revalidatePath("/customer-orders");
  revalidatePath(`/customer-orders/${id}`);
}

export async function deleteCustomerOrder(id: string) {
  const { supabase } = await staffId();
  const { error } = await supabase.from("customer_orders").delete().eq("id", id);
  if (error) return error.message;
  revalidatePath("/customer-orders");
}

export async function updateCustomerOrder(orderId: string, formData: FormData) {
  const { supabase, userId } = await staffId();
  const status = String(formData.get("status") || "");
  const methods = await chosenMethods(supabase, formData);
  if (methods.error) redirect(orderError(orderId, methods.error));
  const { data: current } = await supabase
    .from("customer_orders")
    .select("shipment_method_id, shipping_method, transmission_method_id, transmission_method")
    .eq("id", orderId)
    .maybeSingle();
  const patch: Record<string, unknown> = {
    start_date: blank(formData.get("start_date")),
    cancel_date: blank(formData.get("cancel_date")),
    future_season: blank(formData.get("future_season")),
    shipment_method_id: methods.shipment_method_id,
    shipping_method: methods.shipment_method_id
      ? methods.shipping_method
      : current?.shipment_method_id
        ? null
        : (current?.shipping_method ?? null),
    terms: blank(formData.get("terms")),
    transmission_method_id: methods.transmission_method_id,
    transmission_method: methods.transmission_method_id
      ? methods.transmission_method
      : current?.transmission_method_id
        ? null
        : (current?.transmission_method ?? null),
    notes: blank(formData.get("notes")),
    ship_address_line1: blank(formData.get("ship_address_line1")),
    ship_address_line2: blank(formData.get("ship_address_line2")),
    ship_city: blank(formData.get("ship_city")),
    ship_region: blank(formData.get("ship_region")),
    ship_postal_code: blank(formData.get("ship_postal_code")),
    ship_country: blank(formData.get("ship_country")),
    bill_address_line1: blank(formData.get("bill_address_line1")),
    bill_address_line2: blank(formData.get("bill_address_line2")),
    bill_city: blank(formData.get("bill_city")),
    bill_region: blank(formData.get("bill_region")),
    bill_postal_code: blank(formData.get("bill_postal_code")),
    bill_country: blank(formData.get("bill_country")),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (status) {
    if (!WORKFLOW_STATUS.includes(status as (typeof WORKFLOW_STATUS)[number])) {
      redirect(orderError(orderId, "That status is set from the product lines."));
    }
    const { data: lines } = await supabase
      .from("customer_order_products")
      .select("status")
      .eq("customer_order_id", orderId);
    const blocking = (lines ?? []).some(
      (line) => line.status !== "pending" && line.status !== "canceled",
    );
    if (blocking) {
      redirect(orderError(orderId, "Approved and Picking stay only while every open line is pending."));
    }
    patch.status = status;
  }
  const { error } = await supabase.from("customer_orders").update(patch).eq("id", orderId);
  if (error) redirect(orderError(orderId, error.message));
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
}

export async function addCustomerOrderProduct(orderId: string, formData: FormData) {
  const { supabase } = await staffId();
  const productId = String(formData.get("product_id") || "");
  const { data: product } = await supabase
    .from("products")
    .select("id, type, is_active, standard_price")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.type !== 1 || product.is_active === false) {
    redirect(orderError(orderId, "Pick an active merchandise product."));
  }
  const { error } = await supabase.from("customer_order_products").insert({
    customer_order_id: orderId,
    product_id: productId,
    price: Number(product.standard_price ?? 0),
    status: "pending",
  });
  if (error) {
    const message = error.code === "23505" ? "That product is already on the order." : error.message;
    redirect(orderError(orderId, message));
  }
  const { data: ups } = await supabase
    .from("product_price_upcharges")
    .select("size_id, drop_id, upcharge_amount")
    .eq("product_id", productId);
  const rows = (ups ?? [])
    .filter((u) => Number(u.upcharge_amount) > 0)
    .map((u) => ({
      customer_order_id: orderId,
      product_id: productId,
      size_id: u.size_id,
      drop_id: u.drop_id,
      qty: 0,
      qty_shipped: 0,
      price: Number(u.upcharge_amount),
    }));
  if (rows.length) {
    await supabase.from("customer_order_cells").insert(rows);
  }
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
}

export async function saveCustomerOrderLine(
  orderId: string,
  productId: string,
  formData: FormData,
) {
  const { supabase } = await staffId();
  const price = Number(formData.get("price"));
  if (!Number.isFinite(price) || price < 0) {
    redirect(orderError(orderId, "Enter a line price."));
  }
  const commission = parseCommissionPercent(String(formData.get("commission") ?? ""));
  if (commission === undefined) {
    redirect(orderError(orderId, "Commission is a percent from 0 to 100."));
  }
  const status = String(formData.get("line_status") || "pending");
  const { error: lineError } = await supabase
    .from("customer_order_products")
    .update({ price, commission_rate: commission, status })
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  if (lineError) redirect(orderError(orderId, lineError.message));

  const { data: existing } = await supabase
    .from("customer_order_cells")
    .select("size_id, drop_id, qty_shipped")
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  const shipped = new Map(
    (existing ?? []).map((c) => [`${c.size_id}:${c.drop_id}`, c.qty_shipped as number]),
  );
  const qty = new Map<string, number>();
  const extra = new Map<string, number | null>();
  for (const [key, value] of formData.entries()) {
    const parts = key.split(":");
    if (parts.length < 3) continue;
    const id = `${parts[1]}:${parts[2]}`;
    if (parts[0] === "qty") qty.set(id, Math.max(0, Number(value) || 0));
    if (parts[0] === "up") {
      const text = String(value).trim();
      extra.set(id, text ? Number(text) : null);
    }
  }
  const keys = new Set([...qty.keys(), ...extra.keys(), ...shipped.keys()]);
  const keep = [];
  for (const id of keys) {
    const [sizeId, dropId] = id.split(":");
    const q = qty.get(id) ?? 0;
    const priceExtra = extra.has(id) ? extra.get(id) ?? null : null;
    const qtyShipped = shipped.get(id) ?? 0;
    const amount = priceExtra != null && Number(priceExtra) > 0 ? Number(priceExtra) : null;
    if (q === 0 && amount == null && qtyShipped === 0) continue;
    keep.push({
      customer_order_id: orderId,
      product_id: productId,
      size_id: sizeId,
      drop_id: dropId,
      qty: q,
      qty_shipped: qtyShipped,
      price: amount,
    });
  }
  if (keep.length) {
    const { error } = await supabase.from("customer_order_cells").upsert(keep);
    if (error) redirect(orderError(orderId, error.message));
  }
  const kept = new Set(keep.map((row) => `${row.size_id}:${row.drop_id}`));
  for (const row of existing ?? []) {
    if (kept.has(`${row.size_id}:${row.drop_id}`)) continue;
    await supabase
      .from("customer_order_cells")
      .delete()
      .eq("customer_order_id", orderId)
      .eq("product_id", productId)
      .eq("size_id", row.size_id)
      .eq("drop_id", row.drop_id);
  }
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
}

export async function removeCustomerOrderProduct(orderId: string, productId: string) {
  const { supabase } = await staffId();
  const { error } = await supabase
    .from("customer_order_products")
    .delete()
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  if (error) redirect(orderError(orderId, error.message));
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
}

function orderError(orderId: string, message: string) {
  return `/customer-orders/${orderId}?error=` + encodeURIComponent(message);
}
