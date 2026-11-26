"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { isOpenShipment } from "@/lib/customer-shipment";
import { orderShipKey } from "@/lib/pick-list";
import { PRODUCT_TYPE, productTypeLabel } from "@/lib/product-type";

/** A picked order as it is now. The pick list keeps only ids, so the page reads this each time. */
export type PickOrderInfo = {
  id: string;
  order_no: number;
  po_no: string | null;
  status: string;
  customer_id: string;
  customer: string;
  /** Orders with the same key can go on one shipment. */
  ship_key: string;
  ship_to: string[];
  bill_to: string[];
  terms: string | null;
  shipping_method: string | null;
  sales_rep: string | null;
};

export type PickLineInfo = {
  order_id: string;
  product_id: string;
  label: string;
  type: number;
  status: string;
  /** Ordered minus shipped for merchandise. 1 for a charge that is on no shipment yet. */
  left_to_ship: number;
  /** On a shipment that is not shipped and not canceled. It cannot go on a second one. */
  picking: boolean;
};

export type PickData = { orders: PickOrderInfo[]; lines: PickLineInfo[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

function addressLines(order: Record<string, unknown>, prefix: "ship" | "bill") {
  const text = (key: string) => {
    const value = order[`${prefix}_${key}`];
    return typeof value === "string" ? value.trim() : "";
  };
  const cityLine = [text("city"), [text("region"), text("postal_code")].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [text("address_line1"), text("address_line2"), cityLine, text("country")].filter(Boolean);
}

/** The picked orders and their products as they are now. An order that was deleted is left out. */
export async function loadPickOrders(orderIds: string[]): Promise<PickData | { error: string }> {
  await requireRoles(["admin", "warehouse"]);
  const ids = [...new Set(orderIds.filter((id) => UUID.test(id)))];
  if (!ids.length) return { orders: [], lines: [] };
  const supabase = await createClient();

  const [orderResult, lineResult, cellResult, shippedResult] = await Promise.all([
    supabase
      .from("customer_orders")
      .select(
        "id, order_no, po_no, status, customer_id, terms, shipment_method_id, shipping_method, sales_rep_id, ship_address_line1, ship_address_line2, ship_city, ship_region, ship_postal_code, ship_country, bill_address_line1, bill_address_line2, bill_city, bill_region, bill_postal_code, bill_country, customers ( company_name )",
      )
      .in("id", ids),
    supabase
      .from("customer_order_products")
      .select("customer_order_id, product_id, status, products ( name, type, models ( name ) )")
      .in("customer_order_id", ids),
    supabase
      .from("customer_order_cells")
      .select("customer_order_id, product_id, qty, qty_shipped")
      .in("customer_order_id", ids),
    supabase
      .from("customer_shipment_products")
      .select("customer_order_id, product_id, customer_shipments!inner ( status )")
      .in("customer_order_id", ids)
      .neq("customer_shipments.status", "canceled"),
  ]);
  const failed = orderResult.error ?? lineResult.error ?? cellResult.error ?? shippedResult.error;
  if (failed) return { error: failed.message };

  const repIds = [
    ...new Set(
      (orderResult.data ?? [])
        .map((order) => order.sales_rep_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: people } = repIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", repIds)
    : { data: [] as { id: string; display_name: string | null }[] };

  const orders: PickOrderInfo[] = (orderResult.data ?? []).map((order) => ({
    id: order.id,
    order_no: order.order_no,
    po_no: order.po_no ?? null,
    status: order.status,
    customer_id: order.customer_id,
    customer: one<{ company_name: string }>(order.customers)?.company_name ?? "",
    ship_key: orderShipKey(order),
    ship_to: addressLines(order as Record<string, unknown>, "ship"),
    bill_to: addressLines(order as Record<string, unknown>, "bill"),
    terms: order.terms ?? null,
    shipping_method: order.shipping_method ?? null,
    sales_rep:
      (people ?? []).find((person) => person.id === order.sales_rep_id)?.display_name?.trim() || null,
  }));

  /** Ordered minus shipped, per cell and never below zero. */
  const leftByLine = new Map<string, number>();
  for (const cell of cellResult.data ?? []) {
    const key = `${cell.customer_order_id}:${cell.product_id}`;
    leftByLine.set(
      key,
      (leftByLine.get(key) ?? 0) +
        Math.max(0, Number(cell.qty ?? 0) - Number(cell.qty_shipped ?? 0)),
    );
  }
  const onShipment = new Set(
    (shippedResult.data ?? []).map((row) => `${row.customer_order_id}:${row.product_id}`),
  );
  const onOpenShipment = new Set(
    (shippedResult.data ?? [])
      .filter((row) => isOpenShipment(one<{ status: string }>(row.customer_shipments)?.status))
      .map((row) => `${row.customer_order_id}:${row.product_id}`),
  );

  const lines: PickLineInfo[] = (lineResult.data ?? []).map((line) => {
    const product = one<{ name: string | null; type: number | null; models: unknown }>(line.products);
    const model = one<{ name: string | null }>(product?.models ?? null);
    const type = product?.type ?? PRODUCT_TYPE.merchandise;
    const merchandise = type === PRODUCT_TYPE.merchandise;
    const key = `${line.customer_order_id}:${line.product_id}`;
    return {
      order_id: line.customer_order_id,
      product_id: line.product_id,
      label:
        product?.name?.trim() || (merchandise ? model?.name?.trim() || "Product" : productTypeLabel(type)),
      type,
      status: line.status,
      left_to_ship: merchandise ? (leftByLine.get(key) ?? 0) : onShipment.has(key) ? 0 : 1,
      picking: onOpenShipment.has(key),
    };
  });

  return { orders, lines };
}

/**
 * Creates one shipment from one customer's picked order products. All or nothing:
 * the database refuses, naming the line, when something can no longer ship.
 */
export async function createShipmentFromPicks(
  customerId: string,
  picks: { order_id: string; product_id: string }[],
): Promise<{ error: string } | { id: string; shipment_no: number }> {
  await requireRoles(["admin", "warehouse"]);
  if (!UUID.test(customerId)) return { error: "Pick a customer." };
  const clean = picks.filter((pick) => UUID.test(pick.order_id) && UUID.test(pick.product_id));
  if (!clean.length || clean.length !== picks.length) return { error: "Nothing is picked." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_customer_shipment_from_picks", {
    p_customer_id: customerId,
    p_picks: clean.map((pick) => ({ order_id: pick.order_id, product_id: pick.product_id })),
  });
  if (error) {
    const missing = error.code === "PGRST202" || /could not find the function/i.test(error.message);
    return {
      error: missing ? "Run the pick list SQL in the editor, then try again." : error.message,
    };
  }
  const created = data as { id?: string; shipment_no?: number } | null;
  if (!created?.id || created.shipment_no == null) return { error: "The shipment was not created." };
  revalidatePath("/customer-shipments");
  // The orders on the new shipment are picking now.
  revalidatePath("/customer-orders");
  revalidatePath("/orders");
  return { id: created.id, shipment_no: created.shipment_no };
}
