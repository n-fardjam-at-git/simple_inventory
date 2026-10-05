"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createShipment(formData: FormData) {
  const supabase = await createClient();
  const customerId = String(formData.get("customer_id"));
  const addr = String(formData.get("customer_address_id") || "");
  if (addr) {
    const { data: a } = await supabase
      .from("customer_addresses")
      .select("customer_id, address_type")
      .eq("id", addr)
      .single();
    if (!a || a.customer_id !== customerId || !["shipping", "both"].includes(a.address_type)) {
      throw new Error("Ship-to must be a shipping or both address for this customer");
    }
  }
  const { data, error } = await supabase
    .from("customer_shipments")
    .insert({
      customer_id: customerId,
      customer_address_id: addr || null,
      shipping_date: String(formData.get("shipping_date")),
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message);
  redirect(`/customer-shipments/${data.id}`);
}

export async function addShipmentProduct(shipmentId: string, formData: FormData) {
  const supabase = await createClient();
  await supabase.from("customer_shipment_products").insert({
    customer_shipment_id: shipmentId,
    product_id: String(formData.get("product_id")),
  });
  revalidatePath(`/customer-shipments/${shipmentId}`);
}

export async function saveShipmentCells(shipmentId: string, productRowId: string, formData: FormData) {
  const supabase = await createClient();
  await supabase.from("customer_shipment_cells").delete().eq("customer_shipment_product_id", productRowId);
  const rows = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("cell:")) continue;
    const parts = key.split(":");
    const qty = Number(value) || 0;
    if (qty > 0) {
      rows.push({
        customer_shipment_product_id: productRowId,
        size_id: parts[1],
        drop_id: parts[2],
        qty,
      });
    }
  }
  if (rows.length) await supabase.from("customer_shipment_cells").insert(rows);
  revalidatePath(`/customer-shipments/${shipmentId}`);
}

export async function setShipmentStatus(id: string, formData: FormData) {
  const supabase = await createClient();
  const status = String(formData.get("status"));
  if (status === "shipped") {
    const { error } = await supabase.rpc("post_customer_shipment", {
      p_shipment_id: id,
    });
    if (error) throw new Error(error.message);
  } else {
    await supabase.from("customer_shipments").update({ status }).eq("id", id);
  }
  revalidatePath(`/customer-shipments/${id}`);
}
