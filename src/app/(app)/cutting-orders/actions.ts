"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCellFields } from "@/lib/products";
import { cuttingStatusOpen } from "@/lib/cutting-order";

export async function createCuttingOrder(formData: FormData) {
  const vendor_id = String(formData.get("vendor_id") || "").trim();
  const brand_id = String(formData.get("brand_id") || "").trim();
  const arrival_date = String(formData.get("arrival_date") || "").trim();
  const date_submitted = String(formData.get("date_submitted") || "").trim() || null;
  if (!vendor_id) return "Pick a vendor.";
  if (!brand_id) return "Pick a brand.";
  if (!arrival_date) return "Enter an arrival date.";
  const supabase = await createClient();
  const { error } = await supabase.from("cutting_orders").insert({
    vendor_id,
    brand_id,
    arrival_date,
    date_submitted,
    reference: String(formData.get("reference") || "") || null,
    status: true,
  });
  if (error) return error.message;
  revalidatePath("/cutting-orders");
}

export async function submitCuttingOrder(id: string) {
  const now = new Date();
  const date_submitted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const supabase = await createClient();
  const { error } = await supabase.from("cutting_orders").update({ date_submitted }).eq("id", id);
  if (error) return error.message;
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${id}`);
  return null;
}

export async function deleteCuttingOrder(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cutting_orders").delete().eq("id", id);
  if (error) return error.message;
  revalidatePath("/cutting-orders");
  return null;
}

export async function updateCuttingOrder(
  id: string,
  values: {
    vendor_id: string;
    brand_id: string;
    arrival_date: string;
    date_submitted: string;
    reference: string;
    status: boolean;
  },
) {
  const vendor_id = values.vendor_id.trim();
  const brand_id = values.brand_id.trim();
  const arrival_date = values.arrival_date.trim();
  const date_submitted = values.date_submitted.trim() || null;
  const status = Boolean(values.status);
  if (!vendor_id) return "Pick a vendor.";
  if (!brand_id) return "Pick a brand.";
  if (!arrival_date) return "Enter an arrival date.";
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("cutting_orders")
    .select("brand_id, status")
    .eq("id", id)
    .maybeSingle();
  const wasOpen = cuttingStatusOpen(current?.status);
  if (status && !wasOpen) return "! No open items";
  if (!status && wasOpen) {
    const { error: closeErr } = await supabase
      .from("cutting_order_products")
      .update({ status: false })
      .eq("cutting_order_id", id)
      .eq("status", true);
    if (closeErr) return closeErr.message;
  }
  if (current && current.brand_id !== brand_id) {
    const { data: lotLine } = await supabase
      .from("cutting_order_lots")
      .select("lot_id")
      .eq("cutting_order_id", id)
      .limit(1)
      .maybeSingle();
    const { data: productLine } = await supabase
      .from("cutting_order_products")
      .select("product_id")
      .eq("cutting_order_id", id)
      .limit(1)
      .maybeSingle();
    if (lotLine || productLine) return "Brand cannot be changed while lots or products are on this order.";
  }
  const patch: {
    vendor_id: string;
    brand_id: string;
    arrival_date: string;
    date_submitted: string | null;
    reference: string | null;
    status?: boolean;
  } = {
    vendor_id,
    brand_id,
    arrival_date,
    date_submitted,
    reference: values.reference.trim() || null,
  };
  if (status || !wasOpen) patch.status = status;
  const { error } = await supabase.from("cutting_orders").update(patch).eq("id", id);
  if (error) return error.message;
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${id}`);
  return null;
}

export async function setOrderStatus(id: string, formData: FormData) {
  const open = formData.get("status") === "true";
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("cutting_orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  const wasOpen = cuttingStatusOpen(current?.status);
  if (open && !wasOpen) return "! No open items";
  if (!open && wasOpen) {
    const { error } = await supabase
      .from("cutting_order_products")
      .update({ status: false })
      .eq("cutting_order_id", id)
      .eq("status", true);
    if (error) return error.message;
    revalidatePath("/cutting-orders");
    revalidatePath(`/cutting-orders/${id}`);
    return null;
  }
  const { error } = await supabase.from("cutting_orders").update({ status: open }).eq("id", id);
  if (error) return error.message;
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${id}`);
  return null;
}

export async function createLotForOrder(orderId: string, formData: FormData) {
  if (!orderId) return "Open an order first.";
  const lot_no = String(formData.get("lot_no") || "").trim();
  if (!lot_no) return "Enter a lot number.";
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("cutting_orders")
    .select("brand_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.brand_id) return "This order has no brand.";
  const parts = lot_no.split("-");
  const { error } = await supabase.from("lots").insert({
    lot_no,
    article: parts[0] || null,
    color_num: parts[1] || null,
    brand_id: order.brand_id,
    color_id: String(formData.get("color_id") || "") || null,
    pattern_id: String(formData.get("pattern_id") || "") || null,
    content_id: String(formData.get("content_id") || "") || null,
    mill_article: String(formData.get("mill_article") || "").trim() || null,
  });
  if (error) {
    if (error.code === "23505") return "That lot number already exists for this brand.";
    return error.message;
  }
  revalidatePath("/lots");
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${orderId}`);
  return null;
}

export async function addCuttingOrderLot(orderId: string, formData: FormData) {
  if (!orderId) return "Open an order first.";
  const lotId = String(formData.get("lot_id") || "").trim();
  if (!lotId) return "Pick a lot.";
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("cutting_order_lots")
    .select("lot_id")
    .eq("cutting_order_id", orderId)
    .eq("lot_id", lotId)
    .maybeSingle();
  if (existing) return "Already on this order.";
  const { data: order } = await supabase
    .from("cutting_orders")
    .select("brand_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.brand_id) return "This order has no brand.";
  const { data: lot } = await supabase
    .from("lots")
    .select("id, brand_id")
    .eq("id", lotId)
    .maybeSingle();
  if (!lot) return "Pick a lot.";
  if (lot.brand_id !== order.brand_id) return "Lot brand does not match this order.";
  const { error } = await supabase.from("cutting_order_lots").insert({
    cutting_order_id: orderId,
    lot_id: lotId,
  });
  if (error) {
    if (error.code === "23505") return "Already on this order.";
    return error.message;
  }
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${orderId}`);
  return null;
}

export async function deleteCuttingOrderLot(orderId: string, lotId: string) {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("cutting_order_products")
    .select("product_id, products ( lot_id )")
    .eq("cutting_order_id", orderId);
  const used = (product ?? []).some((row) => {
    const p = Array.isArray(row.products) ? row.products[0] : row.products;
    return (p as { lot_id?: string } | null)?.lot_id === lotId;
  });
  if (used) return "Remove this lot's products from the order first.";
  const { error } = await supabase
    .from("cutting_order_lots")
    .delete()
    .eq("cutting_order_id", orderId)
    .eq("lot_id", lotId);
  if (error) return error.message;
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${orderId}`);
  return null;
}

export async function addCuttingOrderProduct(orderId: string, productId: string) {
  if (!orderId) return "Open an order first.";
  if (!productId) return "Pick a product.";
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("cutting_order_products")
    .select("product_id")
    .eq("cutting_order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();
  if (existing) return "Already on this order.";
  const { data: order } = await supabase
    .from("cutting_orders")
    .select("brand_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.brand_id) return "This order has no brand.";
  const { data: product } = await supabase
    .from("products")
    .select("id, lot_id, lots ( brand_id )")
    .eq("id", productId)
    .maybeSingle();
  const lot = Array.isArray(product?.lots) ? product.lots[0] : product?.lots;
  if ((lot as { brand_id?: string | null } | null)?.brand_id !== order.brand_id) {
    return "Product brand does not match this order.";
  }
  const lotId = product?.lot_id as string | null;
  if (!lotId) return "Product has no lot.";
  const { data: onOrder } = await supabase
    .from("cutting_order_lots")
    .select("lot_id")
    .eq("cutting_order_id", orderId)
    .eq("lot_id", lotId)
    .maybeSingle();
  if (!onOrder) return "Add this lot to the order first.";
  const { error } = await supabase.from("cutting_order_products").insert({
    cutting_order_id: orderId,
    product_id: productId,
    status: true,
  });
  if (error) {
    if (error.code === "23505") return "Already on this order.";
    return error.message;
  }
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${orderId}`);
  return null;
}

export async function saveCuttingOrderLine(
  orderId: string,
  productId: string,
  status: boolean,
  formData: FormData,
  instructions: string,
  bulkOrderQty: number | null,
) {
  const statusMsg = await updateCuttingOrderProduct(orderId, productId, { status });
  if (statusMsg) return statusMsg;
  const supabase = await createClient();
  const { error: instError } = await supabase
    .from("cutting_order_products")
    .update({
      instructions: instructions.trim() || null,
      bulk_order_qty: bulkOrderQty,
    })
    .eq("cutting_order_id", orderId)
    .eq("product_id", productId);
  if (instError) return instError.message;
  const cells = parseCellFields(formData, "ord");
  const keep = [
    ...new Set(
      [...formData.keys()]
        .filter((k) => k.startsWith("keepDrop:"))
        .map((k) => k.slice("keepDrop:".length))
        .filter(Boolean),
    ),
  ];
  if (cells.length) {
    const { error } = await supabase.from("cutting_quantities").upsert(
      cells.map((c) => ({
        cutting_order_id: orderId,
        product_id: productId,
        size_id: c.size_id,
        drop_id: c.drop_id,
        qty_ordered: c.qty,
      })),
      { onConflict: "cutting_order_id,product_id,size_id,drop_id" },
    );
    if (error) return error.message;
  }
  let q = supabase
    .from("cutting_quantities")
    .delete()
    .eq("cutting_order_id", orderId)
    .eq("product_id", productId);
  if (keep.length) {
    q = q.not("drop_id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`);
  }
  const { error: delError } = await q;
  if (delError) return delError.message;
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${orderId}`);
  return null;
}

export async function updateCuttingOrderProduct(
  orderId: string,
  productId: string,
  values: { status: boolean },
) {
  const status = Boolean(values.status);
  const supabase = await createClient();
  const { error } = await supabase
    .from("cutting_order_products")
    .update({ status })
    .eq("cutting_order_id", orderId)
    .eq("product_id", productId)
    .neq("status", status);
  if (error) return error.message;
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${orderId}`);
  return null;
}

export async function deleteCuttingOrderProduct(orderId: string, productId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cutting_order_products")
    .delete()
    .eq("cutting_order_id", orderId)
    .eq("product_id", productId);
  if (error) return error.message;
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${orderId}`);
  return null;
}

export async function setProductStatus(orderId: string, formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("cutting_order_products")
    .update({ status: formData.get("status") === "true" })
    .eq("cutting_order_id", orderId)
    .eq("product_id", String(formData.get("product_id")));
  revalidatePath(`/cutting-orders/${orderId}`);
}

export async function postReceive(orderId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: shipment, error } = await supabase
    .from("cutting_shipments")
    .insert({ cutting_order_id: orderId })
    .select("id")
    .single();
  if (error || !shipment) throw new Error(error?.message);
  const productIds = [...new Set(
    [...formData.keys()]
      .filter((k) => k.startsWith("cell:"))
      .map((k) => k.split(":")[1]),
  )];
  for (const productId of productIds) {
    const { data: sp } = await supabase
      .from("cutting_shipment_products")
      .insert({ cutting_shipment_id: shipment.id, product_id: productId })
      .select("id")
      .single();
    if (!sp) continue;
    const cells = [];
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith(`cell:${productId}:`)) continue;
      const [, , size_id, drop_id] = key.split(":");
      const qty = Number(value) || 0;
      if (qty > 0) cells.push({ cutting_shipment_product_id: sp.id, size_id, drop_id, qty });
    }
    if (cells.length) await supabase.from("cutting_shipment_cells").insert(cells);
  }
  await supabase.rpc("post_cutting_shipment", { p_shipment_id: shipment.id });
  revalidatePath(`/cutting-orders/${orderId}`);
  redirect(`/cutting-orders/${orderId}`);
}
