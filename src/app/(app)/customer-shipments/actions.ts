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
  const productId = String(formData.get("product_id"));
  const { data: prod } = await supabase
    .from("products")
    .select("type, is_active")
    .eq("id", productId)
    .single();
  const type = prod?.type ?? 1;
  if (prod && prod.is_active === false) {
    redirect(
      `/customer-shipments/${shipmentId}?error=` +
        encodeURIComponent("That product is inactive."),
    );
  }
  if (type === 3) {
    const { data: lines } = await supabase
      .from("customer_shipment_products")
      .select("id, products ( type )")
      .eq("customer_shipment_id", shipmentId);
    const hasFreight = (lines ?? []).some((l) => {
      const p = l.products as unknown as { type: number } | { type: number }[] | null;
      const t = Array.isArray(p) ? p[0]?.type : p?.type;
      return t === 3;
    });
    if (hasFreight) {
      redirect(
        `/customer-shipments/${shipmentId}?error=` +
          encodeURIComponent("A shipment can have only one freight charge."),
      );
    }
  }
  await supabase.from("customer_shipment_products").insert({
    customer_shipment_id: shipmentId,
    product_id: productId,
    qty: type === 3 ? 1 : type === 2 ? 1 : 0,
  });
  revalidatePath(`/customer-shipments/${shipmentId}`);
}

export async function saveShipmentQty(shipmentId: string, productRowId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: line } = await supabase
    .from("customer_shipment_products")
    .select("product_id, products ( type )")
    .eq("id", productRowId)
    .single();
  const p = line?.products as unknown as { type: number } | null;
  const type = p?.type ?? 1;
  const qty = type === 3 ? 1 : Math.max(0, Number(formData.get("qty") ?? 0));
  await supabase.from("customer_shipment_products").update({ qty }).eq("id", productRowId);
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
