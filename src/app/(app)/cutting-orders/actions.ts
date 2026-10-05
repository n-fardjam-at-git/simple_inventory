"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCellFields } from "@/lib/products";

export async function createCuttingOrder(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutting_orders")
    .insert({
      vendor_id: String(formData.get("vendor_id")),
      arrival_date: String(formData.get("arrival_date")),
      reference: String(formData.get("reference") || "") || null,
      notes: String(formData.get("notes") || "") || null,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message);
  const productIds = formData.getAll("product_id").map(String);
  if (productIds.length) {
    await supabase.from("cutting_order_products").insert(
      productIds.map((product_id) => ({
        cutting_order_id: data.id,
        product_id,
        status: "open",
      })),
    );
  }
  redirect(`/cutting-orders/${data.id}`);
}

export async function setOrderStatus(id: string, formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("cutting_orders")
    .update({ status: String(formData.get("status")) })
    .eq("id", id);
  revalidatePath(`/cutting-orders/${id}`);
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
