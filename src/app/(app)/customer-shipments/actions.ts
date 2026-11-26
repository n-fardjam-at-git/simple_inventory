"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { isOpenShipment, SHIPMENT_OPEN_STATUS } from "@/lib/customer-shipment";
import { PRODUCT_TYPE, productTypeLabel } from "@/lib/product-type";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Admin and warehouse write a shipment. A sales rep only reads. */
async function writer() {
  await requireRoles(["admin", "warehouse"]);
  return createClient();
}

function fail(shipmentId: string, message: string): never {
  redirect(`/customer-shipments/${shipmentId}?error=${encodeURIComponent(message)}`);
}

/** A shipment change can move an order to or from picking, so the order pages reload too. */
function refresh(shipmentId: string) {
  revalidatePath(`/customer-shipments/${shipmentId}`);
  revalidatePath("/customer-shipments");
  revalidatePath("/customer-orders");
  revalidatePath("/orders");
}

function refreshShipped(shipmentId: string) {
  refresh(shipmentId);
  revalidatePath("/inventory");
}

function blank(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function one<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

/*
 * Each write returns a message when it is refused, or null. The list page shows the
 * message beside the control. The shipment page redirects with it.
 */

/** With `productIds`, only those products of the order are added (migration 0074). */
async function orderOnto(supabase: Db, shipmentId: string, orderId: string, productIds?: string[]) {
  if (!orderId) return "Pick an order.";
  if (productIds && !productIds.length) return "Check at least one product.";
  const { error } = await supabase.rpc("add_order_to_customer_shipment", {
    p_shipment_id: shipmentId,
    p_order_id: orderId,
    ...(productIds ? { p_product_ids: productIds } : {}),
  });
  if (!error) return null;
  const missing = error.code === "PGRST202" || /could not find the function/i.test(error.message);
  return missing && productIds
    ? "Run the add order products SQL (0074) in the editor, then try again."
    : error.message;
}

async function chargeOnto(supabase: Db, shipmentId: string, productId: string) {
  if (!productId) return "Pick a charge.";
  const { data: product } = await supabase
    .from("products")
    .select("type, is_active, standard_price")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.type === PRODUCT_TYPE.merchandise) return "Merchandise ships from an order.";
  if (product.is_active === false) return "That charge is inactive.";
  const { error } = await supabase.from("customer_shipment_products").insert({
    customer_shipment_id: shipmentId,
    product_id: productId,
    qty: 1,
    price: Number(product.standard_price ?? 0),
  });
  if (!error) return null;
  return error.code === "23505" ? "That charge is already on this shipment." : error.message;
}

async function chargeSaved(
  supabase: Db,
  shipmentId: string,
  lineId: string,
  priceRaw: unknown,
  qtyRaw: unknown,
) {
  const { data: line } = await supabase
    .from("customer_shipment_products")
    .select("id, products ( type )")
    .eq("id", lineId)
    .eq("customer_shipment_id", shipmentId)
    .maybeSingle();
  const type = one<{ type: number }>(line?.products)?.type;
  if (!line || type == null || type === PRODUCT_TYPE.merchandise) {
    return "That charge is no longer on this shipment.";
  }
  const price = Number(String(priceRaw ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(price) || price < 0) return "Enter a price of zero or more.";
  const qty = type === PRODUCT_TYPE.freight ? 1 : Math.max(0, Math.round(Number(qtyRaw ?? 0) || 0));
  const { error } = await supabase
    .from("customer_shipment_products")
    .update({ qty, price })
    .eq("id", lineId)
    .eq("customer_shipment_id", shipmentId);
  return error ? error.message : null;
}

/** Saves quantities only. A cell's price stays as copied from the order. A cell the form left out is not changed. */
async function cellsSaved(supabase: Db, shipmentId: string, lineId: string, formData: FormData) {
  const { data: line } = await supabase
    .from("customer_shipment_products")
    .select("id, customer_order_id, product_id")
    .eq("id", lineId)
    .eq("customer_shipment_id", shipmentId)
    .maybeSingle();
  if (!line || !line.customer_order_id) return "That product is no longer on this shipment.";

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
  const label = (id: string) => sizeCode.get(id.split(":")[0]) ?? "that size";

  const typed = new Map<string, number>();
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("cell:")) continue;
    const [, sizeId, dropId] = name.split(":");
    if (!sizeId || !dropId) continue;
    typed.set(key(sizeId, dropId), Math.max(0, Math.round(Number(value) || 0)));
  }
  for (const [id, qty] of typed) {
    if (!current.has(id) && qty > 0) return `Size ${label(id)} is not on the order.`;
  }

  const changes: { size_id: string; drop_id: string; qty: number }[] = [];
  for (const [id, was] of current) {
    const qty = typed.get(id);
    if (qty == null) continue;
    if (qty === was) continue;
    // Lowering is always allowed. A pick list line can start above what the other open shipments leave.
    const room = Math.max(0, left.get(id) ?? 0);
    if (qty > was && qty > room) return `Only ${room} left to ship for size ${label(id)}.`;
    const [size_id, drop_id] = id.split(":");
    changes.push({ size_id, drop_id, qty });
  }

  for (const change of changes) {
    const { error } = await supabase
      .from("customer_shipment_cells")
      .update({ qty: change.qty })
      .eq("customer_shipment_product_id", lineId)
      .eq("size_id", change.size_id)
      .eq("drop_id", change.drop_id);
    if (error) return error.message;
  }
  return null;
}

async function lineRemoved(supabase: Db, shipmentId: string, lineId: string) {
  const { error } = await supabase
    .from("customer_shipment_products")
    .delete()
    .eq("id", lineId)
    .eq("customer_shipment_id", shipmentId);
  return error ? error.message : null;
}

async function shipped(supabase: Db, shipmentId: string, dateShipped: string | null) {
  const { error } = await supabase.rpc("ship_customer_shipment", {
    p_shipment_id: shipmentId,
    p_date_shipped: dateShipped,
  });
  return error ? error.message : null;
}

/* ---- The list page: each returns a message, or null when it wrote. ---- */

export async function createShipmentFor(customerId: string): Promise<string | null> {
  const supabase = await writer();
  if (!customerId) return "Pick a customer.";
  const { error } = await supabase.from("customer_shipments").insert({ customer_id: customerId });
  if (error) return error.message;
  revalidatePath("/customer-shipments");
  return null;
}

/** An open product of an order that Add order can still put on a shipment. */
export type AddableOrderLine = {
  product_id: string;
  type: number;
  label: string;
  /** Merchandise: the units that would be added. A surcharge: its quantity. Freight: 1. */
  qty: number;
  /** A charge: its amount. 0 for merchandise. */
  amount: number;
};

/**
 * The products of an order that Add order would put on this shipment, for the check list.
 * Mirrors `add_order_to_customer_shipment`: the line is open, it is not on this shipment,
 * merchandise has something left after shipped and other open shipments, and a charge is
 * on no shipment that is not canceled.
 */
export async function loadAddableOrderProducts(
  shipmentId: string,
  orderId: string,
): Promise<{ lines: AddableOrderLine[] } | { error: string }> {
  const supabase = await writer();
  if (!shipmentId || !orderId) return { lines: [] };
  const [lineResult, cellResult, shippedResult] = await Promise.all([
    supabase
      .from("customer_order_products")
      .select("product_id, price, qty, products ( name, type, models ( name ) )")
      .eq("customer_order_id", orderId)
      .in("status", ["pending", "back_order"]),
    supabase
      .from("customer_order_cells")
      .select("product_id, size_id, drop_id, qty, qty_shipped")
      .eq("customer_order_id", orderId),
    supabase
      .from("customer_shipment_products")
      .select(
        "customer_shipment_id, product_id, customer_shipments!inner ( status ), customer_shipment_cells ( size_id, drop_id, qty )",
      )
      .eq("customer_order_id", orderId)
      .neq("customer_shipments.status", "canceled"),
  ]);
  const failed = lineResult.error ?? cellResult.error ?? shippedResult.error;
  if (failed) return { error: failed.message };

  const onThisShipment = new Set<string>();
  const onAnyShipment = new Set<string>();
  /** Quantity on shipments that have not shipped, per product, size, and drop. */
  const openQty = new Map<string, number>();
  for (const row of shippedResult.data ?? []) {
    onAnyShipment.add(row.product_id);
    if (row.customer_shipment_id === shipmentId) onThisShipment.add(row.product_id);
    if (!isOpenShipment(one<{ status: string }>(row.customer_shipments)?.status)) continue;
    for (const cell of row.customer_shipment_cells ?? []) {
      const key = `${row.product_id}:${cell.size_id}:${cell.drop_id}`;
      openQty.set(key, (openQty.get(key) ?? 0) + Number(cell.qty ?? 0));
    }
  }
  const leftByProduct = new Map<string, number>();
  for (const cell of cellResult.data ?? []) {
    const left =
      Number(cell.qty ?? 0) -
      Number(cell.qty_shipped ?? 0) -
      (openQty.get(`${cell.product_id}:${cell.size_id}:${cell.drop_id}`) ?? 0);
    if (left > 0) leftByProduct.set(cell.product_id, (leftByProduct.get(cell.product_id) ?? 0) + left);
  }

  const lines: AddableOrderLine[] = [];
  for (const line of lineResult.data ?? []) {
    if (onThisShipment.has(line.product_id)) continue;
    const product = one<{ name: string | null; type: number | null; models: unknown }>(line.products);
    const model = one<{ name: string | null }>(product?.models ?? null);
    const type = product?.type ?? PRODUCT_TYPE.merchandise;
    if (type === PRODUCT_TYPE.merchandise) {
      const left = leftByProduct.get(line.product_id) ?? 0;
      if (left <= 0) continue;
      lines.push({
        product_id: line.product_id,
        type,
        label: product?.name?.trim() || model?.name?.trim() || "Product",
        qty: left,
        amount: 0,
      });
      continue;
    }
    if (onAnyShipment.has(line.product_id)) continue;
    const qty = type === PRODUCT_TYPE.freight ? 1 : Number(line.qty ?? 1);
    lines.push({
      product_id: line.product_id,
      type,
      label: product?.name?.trim() || productTypeLabel(type),
      qty,
      amount: qty * Number(line.price ?? 0),
    });
  }
  lines.sort(
    (a, b) => a.type - b.type || a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
  );
  return { lines };
}

/**
 * Adds the open lines of an order: every one, or only `productIds` when given.
 * The first order fills the shipment header.
 */
export async function addOrderToShipment(
  shipmentId: string,
  orderId: string,
  productIds?: string[],
): Promise<string | null> {
  const message = await orderOnto(await writer(), shipmentId, orderId, productIds);
  if (!message) refresh(shipmentId);
  return message;
}

/** Freight or a surcharge that is not on an order. */
export async function addChargeToShipment(shipmentId: string, productId: string): Promise<string | null> {
  const message = await chargeOnto(await writer(), shipmentId, productId);
  if (!message) refresh(shipmentId);
  return message;
}

export async function saveShipmentLineQty(
  shipmentId: string,
  lineId: string,
  formData: FormData,
): Promise<string | null> {
  const message = await cellsSaved(await writer(), shipmentId, lineId, formData);
  if (!message) refresh(shipmentId);
  return message;
}

export async function saveShipmentLineCharge(
  shipmentId: string,
  lineId: string,
  price: number,
  qty: number,
): Promise<string | null> {
  const message = await chargeSaved(await writer(), shipmentId, lineId, price, qty);
  if (!message) refresh(shipmentId);
  return message;
}

export async function removeShipmentLineById(shipmentId: string, lineId: string): Promise<string | null> {
  const message = await lineRemoved(await writer(), shipmentId, lineId);
  if (!message) refresh(shipmentId);
  return message;
}

/**
 * Status, picker, tracking number, Sage invoice number, and notes from the edit card.
 * A shipped shipment keeps its status and picker. Shipped is set by Ship.
 */
export async function saveShipmentHeader(shipmentId: string, formData: FormData): Promise<string | null> {
  const supabase = await writer();
  const { data: shipment } = await supabase
    .from("customer_shipments")
    .select("status")
    .eq("id", shipmentId)
    .maybeSingle();
  if (!shipment) return "That shipment is no longer here.";
  if (shipment.status === "canceled") return "A canceled shipment cannot be changed.";
  const patch: Record<string, unknown> = {
    tracking_no: blank(formData.get("tracking_no")),
    notes: blank(formData.get("notes")),
  };
  if (formData.has("sage_invoice_no")) {
    patch.sage_invoice_no = blank(formData.get("sage_invoice_no"));
  }
  if (isOpenShipment(shipment.status)) {
    const status = String(formData.get("status") || "");
    const allowed: string[] = [...SHIPMENT_OPEN_STATUS, "canceled"];
    if (!allowed.includes(status)) return "Pick a status.";
    patch.status = status;
    patch.picker_id = blank(formData.get("picker_id"));
  }
  const { error } = await supabase.from("customer_shipments").update(patch).eq("id", shipmentId);
  if (error) return error.message;
  refresh(shipmentId);
  return null;
}

/**
 * Deletes a shipment that has not shipped, with its lines. Nothing was taken off inventory
 * or added to shipped, so the orders are left as they were.
 */
export async function deleteShipment(shipmentId: string): Promise<string | null> {
  const supabase = await writer();
  const { data: shipment } = await supabase
    .from("customer_shipments")
    .select("status")
    .eq("id", shipmentId)
    .maybeSingle();
  if (!shipment) return "That shipment is no longer here.";
  if (shipment.status === "shipped") return "A shipped shipment cannot be deleted.";
  const { data: gone, error } = await supabase
    .from("customer_shipments")
    .delete()
    .eq("id", shipmentId)
    .select("id");
  if (error) return error.message;
  if (!gone?.length) return "That shipment could not be deleted.";
  refresh(shipmentId);
  return null;
}

/** Takes the stock off inventory, adds to shipped on the orders, and locks the shipment. */
export async function shipShipmentOn(shipmentId: string, dateShipped: string): Promise<string | null> {
  const message = await shipped(await writer(), shipmentId, dateShipped.trim() || null);
  if (!message) refreshShipped(shipmentId);
  return message;
}

/* ---- The shipment page: form actions that redirect with the message. ---- */

export async function addShipmentOrder(shipmentId: string, formData: FormData) {
  const supabase = await writer();
  const message = await orderOnto(supabase, shipmentId, String(formData.get("customer_order_id") || ""));
  if (message) fail(shipmentId, message);
  refresh(shipmentId);
}

export async function addShipmentCharge(shipmentId: string, formData: FormData) {
  const supabase = await writer();
  const message = await chargeOnto(supabase, shipmentId, String(formData.get("product_id") || ""));
  if (message) fail(shipmentId, message);
  refresh(shipmentId);
}

export async function saveShipmentCharge(shipmentId: string, lineId: string, formData: FormData) {
  const supabase = await writer();
  const message = await chargeSaved(
    supabase,
    shipmentId,
    lineId,
    formData.get("price"),
    formData.get("qty"),
  );
  if (message) fail(shipmentId, message);
  refresh(shipmentId);
}

export async function saveShipmentCells(shipmentId: string, lineId: string, formData: FormData) {
  const supabase = await writer();
  const message = await cellsSaved(supabase, shipmentId, lineId, formData);
  if (message) fail(shipmentId, message);
  refresh(shipmentId);
}

export async function removeShipmentLine(shipmentId: string, lineId: string) {
  const supabase = await writer();
  const message = await lineRemoved(supabase, shipmentId, lineId);
  if (message) fail(shipmentId, message);
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

export async function shipShipment(shipmentId: string, formData: FormData) {
  const supabase = await writer();
  const message = await shipped(supabase, shipmentId, blank(formData.get("date_shipped")));
  if (message) fail(shipmentId, message);
  refreshShipped(shipmentId);
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
