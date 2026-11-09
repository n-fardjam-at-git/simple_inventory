"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LINE_STATUS, parseCommissionPercent, SHIP_AT_ONCE, shipmentMethodLabel, WORKFLOW_STATUS } from "@/lib/customer-order";
import { PRODUCT_TYPE } from "@/lib/product-type";
import { parseCellFields } from "@/lib/products";

function blank(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function knownTerm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  term: string | null,
  kept?: string | null,
) {
  if (!term || term === kept) return true;
  const { data } = await supabase.from("payment_terms").select("term").eq("term", term).maybeSingle();
  return Boolean(data);
}

async function staffId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

async function merchandiseBlocksWorkflow(
  supabase: Awaited<ReturnType<typeof staffId>>["supabase"],
  orderId: string,
) {
  const { data: lines } = await supabase
    .from("customer_order_products")
    .select("status, products!inner(type)")
    .eq("customer_order_id", orderId)
    .eq("products.type", PRODUCT_TYPE.merchandise);
  return (lines ?? []).some(
    (line) => line.status !== "pending" && line.status !== "canceled",
  );
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
    .select("id, sales_rep_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return "Pick a customer.";
  const chosenTerm = blank(formData.get("terms"));
  if (!(await knownTerm(supabase, chosenTerm))) return "Pick a term.";
  const { error } = await supabase.from("customer_orders").insert({
    customer_id: customerId,
    start_date: blank(formData.get("start_date")),
    cancel_date: blank(formData.get("cancel_date")),
    future_season: futureSeason,
    shipment_method_id: methods.shipment_method_id,
    shipping_method: methods.shipping_method,
    transmission_method_id: methods.transmission_method_id,
    transmission_method: methods.transmission_method,
    terms: blank(formData.get("terms")),
    sales_rep_id: customer?.sales_rep_id ?? null,
    created_by: userId,
    updated_by: userId,
    notes: blank(formData.get("notes")),
    ...addressFields("ship", ship),
    ...addressFields("bill", bill),
  });
  if (error) return error.message;
  revalidatePath("/customer-orders");
}

export async function saveCustomerOrderHeader(orderId: string, formData: FormData) {
  const { supabase, userId } = await staffId();
  const customerId = String(formData.get("customer_id") || "");
  if (!customerId) return "Pick a customer.";
  const shipKeep = formData.get("ship_keep") === "1";
  const billKeep = formData.get("bill_keep") === "1";
  const ship = shipKeep
    ? null
    : await addressFor(
        supabase,
        String(formData.get("ship_address_id") || ""),
        customerId,
        ["shipping", "both"],
      );
  const bill = billKeep
    ? null
    : await addressFor(
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
    .select("id, sales_rep_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return "Pick a customer.";
  const { data: current } = await supabase
    .from("customer_orders")
    .select(
      "shipment_method_id, shipping_method, transmission_method_id, transmission_method, terms",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!current) return "That order is gone.";
  const chosenTerm = blank(formData.get("terms"));
  if (!(await knownTerm(supabase, chosenTerm, current.terms))) return "Pick a term.";
  const patch: Record<string, unknown> = {
    customer_id: customerId,
    sales_rep_id: customer.sales_rep_id,
    start_date: blank(formData.get("start_date")),
    cancel_date: blank(formData.get("cancel_date")),
    future_season: futureSeason,
    terms: blank(formData.get("terms")),
    notes: blank(formData.get("notes")),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (formData.get("method_keep") === "1") {
    patch.shipment_method_id = current.shipment_method_id;
    patch.shipping_method = current.shipping_method;
  } else {
    patch.shipment_method_id = methods.shipment_method_id;
    patch.shipping_method = methods.shipping_method;
  }
  if (formData.get("received_keep") === "1") {
    patch.transmission_method_id = current.transmission_method_id;
    patch.transmission_method = current.transmission_method;
  } else {
    patch.transmission_method_id = methods.transmission_method_id;
    patch.transmission_method = methods.transmission_method;
  }
  if (!shipKeep) Object.assign(patch, addressFields("ship", ship));
  if (!billKeep) Object.assign(patch, addressFields("bill", bill));
  const { error } = await supabase.from("customer_orders").update(patch).eq("id", orderId);
  if (error) return error.message;
  revalidatePath("/customer-orders");
  revalidatePath(`/customer-orders/${orderId}`);
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
      return "That status is set from the merchandise lines.";
    }
    if (await merchandiseBlocksWorkflow(supabase, id)) {
      return "Approved and Picking stay only while every open merchandise line is pending.";
    }
    next.status = patch.status;
  }
  const { error } = await supabase.from("customer_orders").update(next).eq("id", id);
  if (error) return error.message;
  revalidatePath("/customer-orders");
  revalidatePath(`/customer-orders/${id}`);
}

export async function approveCustomerOrder(orderId: string) {
  const { supabase, userId } = await staffId();
  const { data: order } = await supabase
    .from("customer_orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return "That order is gone.";
  if (order.status !== "pending") return "Approve stays only while the order is pending.";
  if (await merchandiseBlocksWorkflow(supabase, orderId)) {
    return "Approved and Picking stay only while every open merchandise line is pending.";
  }
  const { error } = await supabase
    .from("customer_orders")
    .update({
      status: "approved",
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return error.message;
  revalidatePath("/customer-orders");
  revalidatePath(`/customer-orders/${orderId}`);
}

export async function revokeCustomerOrder(orderId: string) {
  const { supabase, userId } = await staffId();
  const { data: order } = await supabase
    .from("customer_orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return "That order is gone.";
  if (order.status !== "approved") return "Revoke stays only while the order is approved.";
  const { error } = await supabase
    .from("customer_orders")
    .update({
      status: "pending",
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return error.message;
  revalidatePath("/customer-orders");
  revalidatePath(`/customer-orders/${orderId}`);
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
      redirect(orderError(orderId, "That status is set from the merchandise lines."));
    }
    if (await merchandiseBlocksWorkflow(supabase, orderId)) {
      redirect(
        orderError(orderId, "Approved and Picking stay only while every open merchandise line is pending."),
      );
    }
    patch.status = status;
  }
  const { error } = await supabase.from("customer_orders").update(patch).eq("id", orderId);
  if (error) redirect(orderError(orderId, error.message));
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
}

export type OrderProductDraft = {
  price: string;
  sizes: { id: string; code: string; sort_order: number }[];
  drops: { id: string; code: string; sort_order: number }[];
  cells: { size_id: string; drop_id: string; qty: number; upcharge: number }[];
};

export async function loadOrderProductDraft(productId: string): Promise<OrderProductDraft | string> {
  if (!productId) return "Pick a product.";
  const { supabase } = await staffId();
  const { data: product } = await supabase
    .from("products")
    .select("id, type, is_active, standard_price")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.type !== 1 || product.is_active === false) {
    return "Pick an active merchandise product.";
  }
  const [{ data: sizeRows }, { data: dropRows }, { data: ups }] = await Promise.all([
    supabase
      .from("product_sizes")
      .select("size_chart_sizes ( id, code, sort_order )")
      .eq("product_id", productId),
    supabase
      .from("product_drops")
      .select("size_chart_drops ( id, code, sort_order )")
      .eq("product_id", productId),
    supabase
      .from("product_price_upcharges")
      .select("size_id, drop_id, upcharge_amount")
      .eq("product_id", productId),
  ]);
  const dim = (raw: unknown) => {
    const row = (Array.isArray(raw) ? raw[0] : raw) as {
      id: string;
      code: string;
      sort_order: number;
    } | null;
    return row;
  };
  const sizes = (sizeRows ?? [])
    .map((row) => dim(row.size_chart_sizes))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.sort_order - b.sort_order);
  const drops = (dropRows ?? [])
    .map((row) => dim(row.size_chart_drops))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.sort_order - b.sort_order);
  const cells = (ups ?? [])
    .filter((row) => Number(row.upcharge_amount) > 0)
    .map((row) => ({
      size_id: row.size_id,
      drop_id: row.drop_id,
      qty: 0,
      upcharge: Number(row.upcharge_amount),
    }));
  return {
    price: Number(product.standard_price ?? 0).toFixed(2),
    sizes,
    drops,
    cells,
  };
}

function lookupName(raw: unknown) {
  const row = (Array.isArray(raw) ? raw[0] : raw) as { name?: string | null } | null;
  const name = row?.name?.trim();
  return name || null;
}

export type ProductInventory = {
  /** Brand, color, pattern, and content, separated by middots. Empty when the lot has none. */
  description: string;
  sizes: { id: string; code: string; sort_order: number }[];
  drops: { id: string; code: string; sort_order: number }[];
  cells: { size_id: string; drop_id: string; qty: number }[];
  /** Soonest arrival of an open, submitted cutting, `YYYY-MM-DD`. Null when none. */
  arrives_next: string | null;
};

/** On-hand cells, the fabric line, and the next cutting arrival for one product. Read only. */
export async function loadProductInventory(productId: string): Promise<ProductInventory | string> {
  if (!productId) return "Pick a product.";
  const { supabase, userId } = await staffId();
  if (!userId) return "Sign in again.";
  const [
    { data: rows, error },
    { data: arrival, error: arrivalError },
    { data: sizeRows },
    { data: dropRows },
    { data: product, error: productError },
  ] = await Promise.all([
    supabase
      .from("inventory")
      .select("size_id, drop_id, qty_on_hand")
      .eq("product_id", productId),
    supabase.rpc("product_next_arrival", { p_product_id: productId }),
    supabase
      .from("product_sizes")
      .select("size_chart_sizes ( id, code, sort_order )")
      .eq("product_id", productId),
    supabase
      .from("product_drops")
      .select("size_chart_drops ( id, code, sort_order )")
      .eq("product_id", productId),
    supabase
      .from("products")
      .select(
        "lots ( brands ( name ), colors ( name ), patterns ( name ), contents ( name ) )",
      )
      .eq("id", productId)
      .maybeSingle(),
  ]);
  if (error) return error.message;
  if (arrivalError) return arrivalError.message;
  if (productError) return productError.message;
  const dim = (raw: unknown) =>
    (Array.isArray(raw) ? raw[0] : raw) as { id: string; code: string; sort_order: number } | null;
  const keep = <T,>(row: T | null): row is T => Boolean(row);
  const lot = (Array.isArray(product?.lots) ? product.lots[0] : product?.lots) as {
    brands: unknown;
    colors: unknown;
    patterns: unknown;
    contents: unknown;
  } | null;
  return {
    description: [lookupName(lot?.brands), lookupName(lot?.colors), lookupName(lot?.patterns), lookupName(lot?.contents)]
      .filter(Boolean)
      .join(" · "),
    sizes: (sizeRows ?? [])
      .map((row) => dim(row.size_chart_sizes))
      .filter(keep)
      .sort((a, b) => a.sort_order - b.sort_order),
    drops: (dropRows ?? [])
      .map((row) => dim(row.size_chart_drops))
      .filter(keep)
      .sort((a, b) => a.sort_order - b.sort_order),
    cells: (rows ?? []).map((row) => ({
      size_id: row.size_id,
      drop_id: row.drop_id,
      qty: Number(row.qty_on_hand ?? 0),
    })),
    arrives_next: arrival ? String(arrival).slice(0, 10) : null,
  };
}

export type NextCutting = {
  order_num: number | null;
  cells: { size_id: string; drop_id: string; qty: number }[];
};

/** Ordered size/drop qty on the coming cutting. Read only. Needs migration 0057. */
export async function loadNextCutting(productId: string): Promise<NextCutting | string> {
  if (!productId) return "Pick a product.";
  const { supabase, userId } = await staffId();
  if (!userId) return "Sign in again.";
  const { data, error } = await supabase.rpc("product_next_cutting", { p_product_id: productId });
  if (error) {
    if (error.message.includes("product_next_cutting")) {
      return "Run the new arrival SQL in the editor, then try again.";
    }
    return error.message;
  }
  if (!data) return "That cutting is no longer coming.";
  const row = data as {
    order_num?: number | null;
    cells?: { size_id: string; drop_id: string; qty: number }[] | null;
  };
  return {
    order_num: row.order_num ?? null,
    cells: (row.cells ?? [])
      .map((cell) => ({
        size_id: cell.size_id,
        drop_id: cell.drop_id,
        qty: Number(cell.qty ?? 0),
      }))
      .filter((cell) => cell.qty > 0),
  };
}

export async function addCustomerOrderProductId(
  orderId: string,
  productId: string,
  draft?: { price: number; upcharges: { size_id: string; drop_id: string; amount: number }[] },
) {
  if (!orderId) return "Open an order first.";
  if (!productId) return "Pick a product.";
  const { supabase } = await staffId();
  const { data: product } = await supabase
    .from("products")
    .select("id, type, is_active, standard_price")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.type !== 1 || product.is_active === false) {
    return "Pick an active merchandise product.";
  }
  const price = draft ? Number(draft.price) : Number(product.standard_price ?? 0);
  if (!Number.isFinite(price) || price < 0) return "Enter a price.";
  if (draft?.upcharges.some((row) => !Number.isFinite(row.amount) || row.amount < 0)) {
    return "Enter a size extra of zero or more.";
  }
  const { error } = await supabase.from("customer_order_products").insert({
    customer_order_id: orderId,
    product_id: productId,
    price,
    status: "pending",
  });
  if (error) {
    return error.code === "23505" ? "That product is already on the order." : error.message;
  }
  const ups = draft
    ? draft.upcharges
        .filter((row) => Number(row.amount) > 0)
        .map((row) => ({
          size_id: row.size_id,
          drop_id: row.drop_id,
          upcharge_amount: Number(row.amount),
        }))
    : (
        await supabase
          .from("product_price_upcharges")
          .select("size_id, drop_id, upcharge_amount")
          .eq("product_id", productId)
      ).data ?? [];
  const rows = ups
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
    const { error: cellError } = await supabase.from("customer_order_cells").insert(rows);
    if (cellError) return cellError.message;
  }
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
  return null;
}

export async function addCustomerOrderCharge(
  orderId: string,
  productId: string,
  price: number,
  qty: number,
) {
  if (!orderId) return "Open an order first.";
  if (!productId) return "Pick a charge.";
  const { supabase } = await staffId();
  const { data: product } = await supabase
    .from("products")
    .select("id, type, is_active")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.is_active === false || (product.type !== 2 && product.type !== 3)) {
    return "Pick an active surcharge or freight.";
  }
  if (!Number.isFinite(price) || price < 0) return "Enter a price.";
  const freight = product.type === 3;
  const nextQty = freight ? 1 : Math.trunc(Number(qty));
  if (!freight && (!Number.isFinite(nextQty) || nextQty < 0)) return "Enter a quantity.";
  const { error } = await supabase.from("customer_order_products").insert({
    customer_order_id: orderId,
    product_id: productId,
    price,
    qty: nextQty,
    status: "pending",
  });
  if (error) {
    return error.code === "23505" ? "That product is already on the order." : error.message;
  }
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
  return null;
}

export async function saveCustomerOrderCharge(
  orderId: string,
  productId: string,
  status: string,
  price: number,
  qty: number,
) {
  const { supabase } = await staffId();
  if (!LINE_STATUS.includes(status as (typeof LINE_STATUS)[number])) return "Pick a line status.";
  if (!Number.isFinite(price) || price < 0) return "Enter a price.";
  const { data: product } = await supabase
    .from("products")
    .select("type")
    .eq("id", productId)
    .maybeSingle();
  if (!product || (product.type !== 2 && product.type !== 3)) return "That line is not a charge.";
  const freight = product.type === 3;
  const nextQty = freight ? 1 : Math.trunc(Number(qty));
  if (!freight && (!Number.isFinite(nextQty) || nextQty < 0)) return "Enter a quantity.";
  const { error } = await supabase
    .from("customer_order_products")
    .update({ price, qty: nextQty, status })
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  if (error) return error.message;
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
  return null;
}

export async function addCustomerOrderProduct(orderId: string, formData: FormData) {
  const message = await addCustomerOrderProductId(orderId, String(formData.get("product_id") || ""));
  if (message) redirect(orderError(orderId, message));
}

export async function saveCustomerOrderQty(
  orderId: string,
  productId: string,
  status: string,
  formData: FormData,
) {
  const { supabase } = await staffId();
  if (!LINE_STATUS.includes(status as (typeof LINE_STATUS)[number])) return "Pick a line status.";
  const { error: lineError } = await supabase
    .from("customer_order_products")
    .update({ status })
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  if (lineError) return lineError.message;

  const cells = parseCellFields(formData, "ord");
  const keep = [
    ...new Set(
      [...formData.keys()]
        .filter((key) => key.startsWith("keepDrop:"))
        .map((key) => key.slice("keepDrop:".length))
        .filter(Boolean),
    ),
  ];
  const keepSet = new Set(keep);
  const { data: existing } = await supabase
    .from("customer_order_cells")
    .select("size_id, drop_id, qty_shipped, price")
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  const blocked = (existing ?? []).some(
    (cell) => !keepSet.has(cell.drop_id) && Number(cell.qty_shipped) > 0,
  );
  if (blocked) return "A shipped quantity is still on a drop you removed.";
  const prev = new Map(
    (existing ?? []).map((cell) => [`${cell.size_id}:${cell.drop_id}`, cell]),
  );
  const rows = cells
    .filter((cell) => keepSet.has(cell.drop_id))
    .map((cell) => {
      const old = prev.get(`${cell.size_id}:${cell.drop_id}`);
      return {
        customer_order_id: orderId,
        product_id: productId,
        size_id: cell.size_id,
        drop_id: cell.drop_id,
        qty: Math.max(0, Number(cell.qty) || 0),
        qty_shipped: Number(old?.qty_shipped ?? 0),
        price: old?.price ?? null,
      };
    });
  if (rows.length) {
    const { error } = await supabase.from("customer_order_cells").upsert(rows, {
      onConflict: "customer_order_id,product_id,size_id,drop_id",
    });
    if (error) return error.message;
  }
  let removing = supabase
    .from("customer_order_cells")
    .delete()
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  if (keep.length) {
    removing = removing.not("drop_id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`);
  }
  const { error: delError } = await removing;
  if (delError) return delError.message;
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
  return null;
}

export async function pasteCustomerOrderCells(
  orderId: string,
  productId: string,
  cells: { size_id: string; drop_id: string; qty: number }[],
  itemId: string,
  sizeChartId: string,
  mode: "replace" | "combine" = "replace",
) {
  const derived = cells.filter((cell) => Number(cell.qty) > 0);
  if (!derived.length) return "That copy has no sized qty.";
  const { supabase } = await staffId();
  const { data: line, error: lineError } = await supabase
    .from("customer_order_products")
    .select("product_id, products ( type, size_chart_id, models ( item_id ) )")
    .eq("customer_order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();
  if (lineError) return lineError.message;
  const product = Array.isArray(line?.products) ? line.products[0] : line?.products;
  const model = Array.isArray(product?.models) ? product.models[0] : product?.models;
  const item_id = (model as { item_id?: string | null } | null)?.item_id ?? null;
  const size_chart_id = (product as { size_chart_id?: string | null } | null)?.size_chart_id ?? null;
  const type = (product as { type?: number | null } | null)?.type ?? 1;
  if (!line || type !== 1) return "That line is not merchandise.";
  if (!item_id || !size_chart_id) return "This product needs an item and a size chart.";
  if (item_id !== itemId || size_chart_id !== sizeChartId) {
    return "That copy does not match this product’s item and size chart.";
  }
  const { data: sizeRows } = await supabase
    .from("product_sizes")
    .select("size_id")
    .eq("product_id", productId);
  const { data: dropRows } = await supabase
    .from("product_drops")
    .select("drop_id")
    .eq("product_id", productId);
  const sizeIds = new Set((sizeRows ?? []).map((row) => row.size_id));
  const dropIds = new Set((dropRows ?? []).map((row) => row.drop_id));
  const applied =
    mode === "combine"
      ? derived
      : derived.filter(
          (cell) =>
            (!sizeIds.size || sizeIds.has(cell.size_id)) &&
            (!dropIds.size || dropIds.has(cell.drop_id)),
        );
  const { data: existing, error: existingError } = await supabase
    .from("customer_order_cells")
    .select("size_id, drop_id, qty, qty_shipped, price")
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  if (existingError) return existingError.message;
  const prev = new Map(
    (existing ?? []).map((cell) => [`${cell.size_id}:${cell.drop_id}`, cell]),
  );
  if (mode === "replace") {
    const keep = new Set(applied.map((cell) => `${cell.size_id}:${cell.drop_id}`));
    const blocked = (existing ?? []).some(
      (cell) => Number(cell.qty_shipped) > 0 && !keep.has(`${cell.size_id}:${cell.drop_id}`),
    );
    if (blocked) return "A shipped quantity is still on a drop you removed.";
  }
  if (mode === "combine" && applied.length) {
    const newSizes = [...new Set(applied.map((cell) => cell.size_id))].filter(
      (id) => !sizeIds.has(id),
    );
    const newDrops = [...new Set(applied.map((cell) => cell.drop_id))].filter(
      (id) => !dropIds.has(id),
    );
    if (newSizes.length) {
      const { error } = await supabase.from("product_sizes").insert(
        newSizes.map((size_id) => ({ product_id: productId, size_id })),
      );
      if (error && error.code !== "23505") return error.message;
    }
    if (newDrops.length) {
      const { error } = await supabase.from("product_drops").insert(
        newDrops.map((drop_id) => ({ product_id: productId, drop_id })),
      );
      if (error && error.code !== "23505") return error.message;
    }
    if (newSizes.length || newDrops.length) {
      const { error: sync } = await supabase.rpc("sync_product_inventory", {
        p_product_id: productId,
      });
      if (sync) return sync.message;
    }
  }
  const rows = applied.map((cell) => {
    const old = prev.get(`${cell.size_id}:${cell.drop_id}`);
    const nextQty =
      mode === "combine" ? Number(old?.qty ?? 0) + Number(cell.qty) : Number(cell.qty);
    return {
      customer_order_id: orderId,
      product_id: productId,
      size_id: cell.size_id,
      drop_id: cell.drop_id,
      qty: nextQty,
      qty_shipped: Number(old?.qty_shipped ?? 0),
      price: old?.price ?? null,
    };
  });
  if (rows.length) {
    const { error } = await supabase.from("customer_order_cells").upsert(rows, {
      onConflict: "customer_order_id,product_id,size_id,drop_id",
    });
    if (error) return error.message;
  }
  if (mode === "replace") {
    const keep = new Set(applied.map((cell) => `${cell.size_id}:${cell.drop_id}`));
    for (const cell of existing ?? []) {
      const key = `${cell.size_id}:${cell.drop_id}`;
      if (keep.has(key) || Number(cell.qty) <= 0) continue;
      if (cell.price != null) {
        const { error } = await supabase
          .from("customer_order_cells")
          .update({ qty: 0 })
          .eq("customer_order_id", orderId)
          .eq("product_id", productId)
          .eq("size_id", cell.size_id)
          .eq("drop_id", cell.drop_id);
        if (error) return error.message;
        continue;
      }
      const { error } = await supabase
        .from("customer_order_cells")
        .delete()
        .eq("customer_order_id", orderId)
        .eq("product_id", productId)
        .eq("size_id", cell.size_id)
        .eq("drop_id", cell.drop_id);
      if (error) return error.message;
    }
  }
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
  return null;
}

export async function saveCustomerOrderPrice(
  orderId: string,
  productId: string,
  price: number,
  upcharges: { size_id: string; drop_id: string; amount: number }[],
) {
  const { supabase } = await staffId();
  if (!Number.isFinite(price) || price < 0) return "Enter a price.";
  if (upcharges.some((row) => !row.size_id || !row.drop_id || !Number.isFinite(row.amount) || row.amount < 0)) {
    return "Enter a size extra of zero or more.";
  }
  const { error: lineError } = await supabase
    .from("customer_order_products")
    .update({ price })
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  if (lineError) return lineError.message;

  const { data: existing } = await supabase
    .from("customer_order_cells")
    .select("size_id, drop_id, qty, qty_shipped")
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  const prev = new Map(
    (existing ?? []).map((cell) => [`${cell.size_id}:${cell.drop_id}`, cell]),
  );
  const rows = upcharges.flatMap((row) => {
    const old = prev.get(`${row.size_id}:${row.drop_id}`);
    const amount = Number(row.amount) || 0;
    if (amount <= 0 && !old) return [];
    return [
      {
        customer_order_id: orderId,
        product_id: productId,
        size_id: row.size_id,
        drop_id: row.drop_id,
        qty: Number(old?.qty ?? 0),
        qty_shipped: Number(old?.qty_shipped ?? 0),
        price: amount > 0 ? amount : null,
      },
    ];
  });
  if (rows.length) {
    const { error } = await supabase.from("customer_order_cells").upsert(rows, {
      onConflict: "customer_order_id,product_id,size_id,drop_id",
    });
    if (error) return error.message;
  }
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
  return null;
}

export async function removeCustomerOrderProductId(orderId: string, productId: string) {
  const { supabase } = await staffId();
  const { error } = await supabase
    .from("customer_order_products")
    .delete()
    .eq("customer_order_id", orderId)
    .eq("product_id", productId);
  if (error) return error.message;
  revalidatePath(`/customer-orders/${orderId}`);
  revalidatePath("/customer-orders");
  return null;
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
