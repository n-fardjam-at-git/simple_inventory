"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseCellFields } from "@/lib/products";
import { cuttingStatusOpen } from "@/lib/cutting-order";

function trimOrNull(value: unknown) {
  const t = String(value ?? "").trim();
  return t || null;
}

export async function createVendorShipment(formData: FormData) {
  const vendor_id = String(formData.get("vendor_id") || "").trim();
  const received_date = String(formData.get("received_date") || "").trim();
  if (!vendor_id) return "Pick a vendor.";
  if (!received_date) return "Enter a received date.";
  const supabase = await createClient();
  const { error } = await supabase.from("vendor_shipments").insert({
    vendor_id,
    received_date,
    air_way_no: trimOrNull(formData.get("air_way_no")),
  });
  if (error) return error.message;
  revalidatePath("/vendor-shipments");
}

export async function updateVendorShipment(
  id: string,
  patch: { vendor_id: string; received_date: string; air_way_no: string },
) {
  const vendor_id = patch.vendor_id.trim();
  const received_date = patch.received_date.trim();
  if (!vendor_id) return "Pick a vendor.";
  if (!received_date) return "Enter a received date.";
  const supabase = await createClient();
  const { data: lines } = await supabase
    .from("vendor_shipment_products")
    .select("id")
    .eq("shipment_id", id)
    .limit(1);
  const update: {
    received_date: string;
    air_way_no: string | null;
    vendor_id?: string;
  } = {
    received_date,
    air_way_no: trimOrNull(patch.air_way_no),
  };
  if (!lines?.length) update.vendor_id = vendor_id;
  const { error } = await supabase
    .from("vendor_shipments")
    .update(update)
    .eq("id", id)
    .eq("posted", false);
  if (error) return error.message;
  revalidatePath("/vendor-shipments");
  return null;
}

export async function postVendorShipment(id: string) {
  const opened = await requireOpenShipment(id);
  if (opened.error || !opened.shipment) return opened.error;
  const { error } = await opened.supabase.rpc("post_vendor_shipment", {
    p_shipment_id: id,
  });
  if (error) return error.message;
  revalidatePath("/vendor-shipments");
  revalidatePath("/cutting-orders");
  revalidatePath("/inventory");
  return null;
}

export async function deleteVendorShipment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("vendor_shipments").delete().eq("id", id);
  if (error) return error.message;
  revalidatePath("/vendor-shipments");
  return null;
}

async function requireOpenShipment(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_shipments")
    .select("id, posted, vendor_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { supabase, error: "Shipment not found." as string };
  if (data.posted) return { supabase, error: "Shipment is posted." as string };
  return { supabase, shipment: data, error: null as string | null };
}

export async function addVendorShipmentProducts(
  shipmentId: string,
  cuttingOrderId: string,
  productIds: string[],
) {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (!shipmentId) return "Open a shipment first.";
  if (!cuttingOrderId) return "Pick a cutting.";
  if (!ids.length) return "Pick a product.";
  const opened = await requireOpenShipment(shipmentId);
  if (opened.error || !opened.shipment) return opened.error;
  const { supabase, shipment } = opened;
  const { data: order } = await supabase
    .from("cutting_orders")
    .select("id, vendor_id, status")
    .eq("id", cuttingOrderId)
    .maybeSingle();
  if (!order) return "Pick a cutting.";
  if (!cuttingStatusOpen(order.status)) return "Cutting is not open.";
  if (shipment.vendor_id && order.vendor_id !== shipment.vendor_id) {
    return "Cutting vendor does not match this shipment.";
  }
  const { data: onCutting } = await supabase
    .from("cutting_order_products")
    .select("product_id, status")
    .eq("cutting_order_id", cuttingOrderId)
    .in("product_id", ids);
  const allowed = new Set(
    (onCutting ?? [])
      .filter((p) => cuttingStatusOpen(p.status))
      .map((p) => p.product_id),
  );
  if (ids.some((id) => !allowed.has(id))) return "Product is not open on that cutting.";
  const { data: inserted, error } = await supabase
    .from("vendor_shipment_products")
    .insert(
      ids.map((product_id) => ({
        shipment_id: shipmentId,
        cutting_order_id: cuttingOrderId,
        product_id,
      })),
    )
    .select("id, product_id");
  if (error) {
    if (error.code === "23505") return "Already on this shipment.";
    return error.message;
  }
  const lineIds = (inserted ?? []).map((r) => r.id);
  const { data: qtys } = await supabase
    .from("cutting_quantities")
    .select("product_id, size_id, drop_id, qty_ordered, qty_received")
    .eq("cutting_order_id", cuttingOrderId)
    .in("product_id", ids);
  const cells = [];
  for (const line of inserted ?? []) {
    for (const q of qtys ?? []) {
      if (q.product_id !== line.product_id) continue;
      const remaining = Math.max(
        0,
        Number(q.qty_ordered ?? 0) - Number(q.qty_received ?? 0),
      );
      if (remaining <= 0) continue;
      cells.push({
        shipment_product_id: line.id,
        size_id: q.size_id,
        drop_id: q.drop_id,
        qty: remaining,
      });
    }
  }
  if (cells.length) {
    const { error: cellErr } = await supabase.from("vendor_shipment_cells").insert(cells);
    if (cellErr) {
      if (lineIds.length) {
        await supabase.from("vendor_shipment_products").delete().in("id", lineIds);
      }
      return cellErr.message;
    }
  }
  revalidatePath("/vendor-shipments");
  return null;
}

export async function deleteVendorShipmentProduct(lineId: string) {
  const supabase = await createClient();
  const { data: line } = await supabase
    .from("vendor_shipment_products")
    .select("id, shipment_id")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return "Line not found.";
  const opened = await requireOpenShipment(line.shipment_id);
  if (opened.error) return opened.error;
  const { error } = await supabase.from("vendor_shipment_products").delete().eq("id", lineId);
  if (error) return error.message;
  revalidatePath("/vendor-shipments");
  return null;
}

export async function saveVendorShipmentLine(lineId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: line } = await supabase
    .from("vendor_shipment_products")
    .select("id, shipment_id")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return "Line not found.";
  const opened = await requireOpenShipment(line.shipment_id);
  if (opened.error) return opened.error;
  const cells = parseCellFields(formData, "shp");
  const keep = [
    ...new Set(
      [...formData.keys()]
        .filter((k) => k.startsWith("keepDrop:"))
        .map((k) => k.slice("keepDrop:".length))
        .filter(Boolean),
    ),
  ];
  if (cells.length) {
    const { error } = await supabase.from("vendor_shipment_cells").upsert(
      cells.map((c) => ({
        shipment_product_id: lineId,
        size_id: c.size_id,
        drop_id: c.drop_id,
        qty: c.qty,
      })),
      { onConflict: "shipment_product_id,size_id,drop_id" },
    );
    if (error) return error.message;
  }
  let q = supabase.from("vendor_shipment_cells").delete().eq("shipment_product_id", lineId);
  if (keep.length) {
    q = q.not("drop_id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`);
  }
  const { error: delError } = await q;
  if (delError) return delError.message;
  revalidatePath("/vendor-shipments");
  return null;
}
