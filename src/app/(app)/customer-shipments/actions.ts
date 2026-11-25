"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { isOpenShipment, SHIPMENT_OPEN_STATUS } from "@/lib/customer-shipment";
import { PRODUCT_TYPE } from "@/lib/product-type";

/** Admin and warehouse write a shipment. A sales rep only reads. */
async function writer() {
  await requireRoles(["admin", "warehouse"]);
  return createClient();
}

function fail(shipmentId: string, message: string): never {
  redirect(`/customer-shipments/${shipmentId}?error=${encodeURIComponent(message)}`);
}

function refresh(shipmentId: string) {
  revalidatePath(`/customer-shipments/${shipmentId}`);
  revalidatePath("/customer-shipments");
}

function blank(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function one<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export async function createShipment(formData: FormData) {
  const supabase = await writer();
  const customerId = String(formData.get("customer_id") || "");
  if (!customerId) throw new Error("Pick a customer.");
  const { data, error } = await supabase
    .from("customer_shipments")
    .insert({ customer_id: customerId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not start the shipment.");
  revalidatePath("/customer-shipments");
  redirect(`/customer-shipments/${data.id}`);
}

/** Adds every open line of an order. The first order fills the shipment header. */
export async function addShipmentOrder(shipmentId: string, formData: FormData) {
  const supabase = await writer();
  const orderId = String(formData.get("customer_order_id") || "");
  if (!orderId) fail(shipmentId, "Pick an order.");
  const { error } = await supabase.rpc("add_order_to_customer_shipment", {
    p_shipment_id: shipmentId,
    p_order_id: orderId,
  });
  if (error) fail(shipmentId, error.message);
  refresh(shipmentId);
}

/** Freight or a surcharge that is not on an order. */
export async function addShipmentCharge(shipmentId: string, formData: FormData) {
  const supabase = await writer();
  const productId = String(formData.get("product_id") || "");
  if (!productId) fail(shipmentId, "Pick a charge.");
  const { data: product } = await supabase
    .from("products")
    .select("type, is_active, standard_price")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.type === PRODUCT_TYPE.merchandise) {
    fail(shipmentId, "Merchandise ships from an order.");
  }
  if (product.is_active === false) fail(shipmentId, "That charge is inactive.");
  const { error } = await supabase.from("customer_shipment_products").insert({
    customer_shipment_id: shipmentId,
    product_id: productId,
    qty: 1,
    price: Number(product.standard_price ?? 0),
  });
  if (error) {
    fail(
      shipmentId,
      error.code === "23505" ? "That charge is already on this shipment." : error.message,
    );
  }
  refresh(shipmentId);
}

export async function saveShipmentCharge(shipmentId: string, lineId: string, formData: FormData) {
  const supabase = await writer();
  const { data: line } = await supabase
    .from("customer_shipment_products")
    .select("id, products ( type )")
    .eq("id", lineId)
    .eq("customer_shipment_id", shipmentId)
    .maybeSingle();
  const type = one<{ type: number }>(line?.products)?.type;
  if (!line || type == null || type === PRODUCT_TYPE.merchandise) {
    fail(shipmentId, "That charge is no longer on this shipment.");
  }
  const price = Number(String(formData.get("price") ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(price) || price < 0) fail(shipmentId, "Enter a price of zero or more.");
  const qty =
    type === PRODUCT_TYPE.freight ? 1 : Math.max(0, Math.round(Number(formData.get("qty") ?? 0) || 0));
  const { error } = await supabase
    .from("customer_shipment_products")
    .update({ qty, price })
    .eq("id", lineId)
    .eq("customer_shipment_id", shipmentId);
  if (error) fail(shipmentId, error.message);
  refresh(shipmentId);
}

/** Saves quantities only. A cell's price stays as copied from the order. */
export async function saveShipmentCells(shipmentId: string, lineId: string, formData: FormData) {
  const supabase = await writer();
  const { data: line } = await supabase
    .from("customer_shipment_products")
    .select("id, customer_order_id, product_id")
    .eq("id", lineId)
    .eq("customer_shipment_id", shipmentId)
    .maybeSingle();
  if (!line || !line.customer_order_id) fail(shipmentId, "That product is no longer on this shipment.");

  const [{ data: mine }, { data: ordered }, { data: others }, { data: sizes }] = await Promise.all([
    supabase
      .from("customer_shipment_cells")
      .select("size_id, drop_id, qty")
      .eq("customer_shipment_product_id", lineId),
    supabase
      .from("customer_order_cells")
      .select("size_id, drop_id, qty, qty_shipped")
      .eq("customer_order_id", line.customer_order_id)
      .eq("product_id", line.product_id),
    supabase
      .from("customer_shipment_products")
      .select("id, customer_shipments!inner ( status ), customer_shipment_cells ( size_id, drop_id, qty )")
      .eq("customer_order_id", line.customer_order_id)
      .eq("product_id", line.product_id)
      .neq("id", lineId),
    supabase
      .from("product_sizes")
      .select("size_chart_sizes ( id, code )")
      .eq("product_id", line.product_id),
  ]);

  const key = (sizeId: string, dropId: string) => `${sizeId}:${dropId}`;
  const current = new Map((mine ?? []).map((cell) => [key(cell.size_id, cell.drop_id), Number(cell.qty)]));
  const left = new Map(
    (ordered ?? []).map((cell) => [
      key(cell.size_id, cell.drop_id),
      Number(cell.qty) - Number(cell.qty_shipped),
    ]),
  );
  for (const other of others ?? []) {
    const status = one<{ status: string }>(other.customer_shipments)?.status;
    if (!isOpenShipment(status)) continue;
    for (const cell of (other.customer_shipment_cells ?? []) as {
      size_id: string;
      drop_id: string;
      qty: number;
    }[]) {
      const id = key(cell.size_id, cell.drop_id);
      left.set(id, (left.get(id) ?? 0) - Number(cell.qty));
    }
  }
  const sizeCode = new Map(
    (sizes ?? []).flatMap((row) => {
      const size = one<{ id: string; code: string }>(row.size_chart_sizes);
      return size ? [[size.id, size.code] as const] : [];
    }),
  );

  const changes: { size_id: string; drop_id: string; qty: number }[] = [];
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("cell:")) continue;
    const [, sizeId, dropId] = name.split(":");
    if (!sizeId || !dropId) continue;
    const qty = Math.max(0, Math.round(Number(value) || 0));
    const id = key(sizeId, dropId);
    const label = sizeCode.get(sizeId) ?? "that size";
    if (!current.has(id)) {
      if (qty > 0) fail(shipmentId, `Size ${label} is not on the order.`);
      continue;
    }
    const room = Math.max(0, left.get(id) ?? 0);
    if (qty > room) fail(shipmentId, `Only ${room} left to ship for size ${label}.`);
    if (qty !== current.get(id)) changes.push({ size_id: sizeId, drop_id: dropId, qty });
  }

  for (const change of changes) {
    const { error } = await supabase
      .from("customer_shipment_cells")
      .update({ qty: change.qty })
      .eq("customer_shipment_product_id", lineId)
      .eq("size_id", change.size_id)
      .eq("drop_id", change.drop_id);
    if (error) fail(shipmentId, error.message);
  }
  refresh(shipmentId);
}

export async function removeShipmentLine(shipmentId: string, lineId: string) {
  const supabase = await writer();
  const { error } = await supabase
    .from("customer_shipment_products")
    .delete()
    .eq("id", lineId)
    .eq("customer_shipment_id", shipmentId);
  if (error) fail(shipmentId, error.message);
  refresh(shipmentId);
}

/** Moves between the open statuses, or cancels. Shipped is set by Ship. */
export async function setShipmentStatus(shipmentId: string, formData: FormData) {
  const supabase = await writer();
  const status = String(formData.get("status") || "");
  const allowed: string[] = [...SHIPMENT_OPEN_STATUS, "canceled"];
  if (!allowed.includes(status)) fail(shipmentId, "Pick a status.");
  const { error } = await supabase.from("customer_shipments").update({ status }).eq("id", shipmentId);
  if (error) fail(shipmentId, error.message);
  refresh(shipmentId);
}

/** Takes the stock off inventory, adds to shipped on the orders, and locks the shipment. */
export async function shipShipment(shipmentId: string, formData: FormData) {
  const supabase = await writer();
  const { error } = await supabase.rpc("ship_customer_shipment", {
    p_shipment_id: shipmentId,
    p_date_shipped: blank(formData.get("date_shipped")),
  });
  if (error) fail(shipmentId, error.message);
  refresh(shipmentId);
  revalidatePath("/customer-orders");
  revalidatePath("/orders");
  revalidatePath("/inventory");
}

/** Picker, tracking number, and notes. A shipped shipment keeps its picker. */
export async function saveShipmentDetails(shipmentId: string, formData: FormData) {
  const supabase = await writer();
  const patch: Record<string, unknown> = {
    tracking_no: blank(formData.get("tracking_no")),
    notes: blank(formData.get("notes")),
  };
  if (formData.has("picker_id")) patch.picker_id = blank(formData.get("picker_id"));
  const { error } = await supabase.from("customer_shipments").update(patch).eq("id", shipmentId);
  if (error) fail(shipmentId, error.message);
  refresh(shipmentId);
}
