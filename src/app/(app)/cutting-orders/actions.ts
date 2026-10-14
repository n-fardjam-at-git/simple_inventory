"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCellFields } from "@/lib/products";

export async function createCuttingOrder(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("cutting_orders").insert({
    vendor_id: String(formData.get("vendor_id")),
    arrival_date: String(formData.get("arrival_date")),
    reference: String(formData.get("reference") || "") || null,
    status: "open",
  });
  if (error) return error.message;
  revalidatePath("/cutting-orders");
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
    arrival_date: string;
    reference: string;
    status: string;
  },
) {
  const vendor_id = values.vendor_id.trim();
  const arrival_date = values.arrival_date.trim();
  const status = values.status.trim();
  if (!vendor_id) return "Pick a vendor.";
  if (!arrival_date) return "Enter an arrival date.";
  if (!["open", "received", "cancelled"].includes(status)) return "Pick a status.";
  const supabase = await createClient();
  const { error } = await supabase
    .from("cutting_orders")
    .update({
      vendor_id,
      arrival_date,
      reference: values.reference.trim() || null,
      status,
    })
    .eq("id", id);
  if (error) return error.message;
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${id}`);
  return null;
}

export async function setOrderStatus(id: string, formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("cutting_orders")
    .update({ status: String(formData.get("status")) })
    .eq("id", id);
  revalidatePath(`/cutting-orders/${id}`);
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
  const { error } = await supabase.from("cutting_order_products").insert({
    cutting_order_id: orderId,
    product_id: productId,
    status: "open",
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
  status: string,
  formData: FormData,
) {
  const statusMsg = await updateCuttingOrderProduct(orderId, productId, { status });
  if (statusMsg) return statusMsg;
  const cells = parseCellFields(formData, "ord");
  if (!cells.length) return null;
  const supabase = await createClient();
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
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${orderId}`);
  return null;
}

export async function updateCuttingOrderProduct(
  orderId: string,
  productId: string,
  values: { status: string },
) {
  const status = values.status.trim();
  if (!["open", "complete"].includes(status)) return "Pick a status.";
  const supabase = await createClient();
  const { error } = await supabase
    .from("cutting_order_products")
    .update({ status })
    .eq("cutting_order_id", orderId)
    .eq("product_id", productId);
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
    .update({ status: String(formData.get("status")) })
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
