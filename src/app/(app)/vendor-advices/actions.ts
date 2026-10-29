"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { parseCellFields } from "@/lib/products";
import { cuttingStatusOpen } from "@/lib/cutting-order";

function trimOrNull(value: unknown) {
  const t = String(value ?? "").trim();
  return t || null;
}

function revalidate() {
  revalidatePath("/vendor-advices");
  revalidatePath("/vendor-shipments");
}

async function requireDraft(adviceId: string) {
  await requireRoles(["vendor"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_advices")
    .select("id, status, vendor_id")
    .eq("id", adviceId)
    .maybeSingle();
  if (!data) return { supabase, error: "Packing list not found." as string };
  if (data.status !== "draft") return { supabase, error: "Packing list is locked." as string };
  return { supabase, advice: data, error: null as string | null };
}

export async function createVendorAdvice(formData: FormData) {
  const profile = await requireRoles(["vendor"]);
  const ship_date = String(formData.get("ship_date") || "").trim();
  if (!ship_date) return "Enter a ship date.";
  const supabase = await createClient();
  const { data: me } = await supabase
    .from("profiles")
    .select("vendor_id")
    .eq("id", profile.id)
    .maybeSingle();
  if (!me?.vendor_id) return "This login is not linked to a vendor.";
  const { error } = await supabase.from("vendor_advices").insert({
    vendor_id: me.vendor_id,
    ship_date,
    air_way_no: trimOrNull(formData.get("air_way_no")),
    status: "draft",
  });
  if (error) return error.message;
  revalidate();
  return null;
}

export async function updateVendorAdvice(
  id: string,
  patch: { ship_date: string; air_way_no: string; notes: string },
) {
  const ship_date = patch.ship_date.trim();
  if (!ship_date) return "Enter a ship date.";
  const opened = await requireDraft(id);
  if (opened.error) return opened.error;
  const { error } = await opened.supabase
    .from("vendor_advices")
    .update({
      ship_date,
      air_way_no: trimOrNull(patch.air_way_no),
      notes: trimOrNull(patch.notes),
    })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return error.message;
  revalidate();
  return null;
}

export async function submitVendorAdvice(id: string) {
  const opened = await requireDraft(id);
  if (opened.error) return opened.error;
  const { error } = await opened.supabase
    .from("vendor_advices")
    .update({ status: "submitted" })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return error.message;
  revalidate();
  return null;
}

export async function deleteVendorAdvice(id: string) {
  const opened = await requireDraft(id);
  if (opened.error) return opened.error;
  const { error } = await opened.supabase.from("vendor_advices").delete().eq("id", id);
  if (error) return error.message;
  revalidate();
  return null;
}

export async function addVendorAdviceProducts(
  adviceId: string,
  cuttingOrderId: string,
  productIds: string[],
) {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (!adviceId) return "Open a packing list first.";
  if (!cuttingOrderId) return "Pick a cutting.";
  if (!ids.length) return "Pick a product.";
  const opened = await requireDraft(adviceId);
  if (opened.error || !opened.advice) return opened.error;
  const { supabase, advice } = opened;
  const { data: order } = await supabase
    .from("cutting_orders")
    .select("id, vendor_id, status")
    .eq("id", cuttingOrderId)
    .maybeSingle();
  if (!order) return "Pick a cutting.";
  if (!cuttingStatusOpen(order.status)) return "Cutting is not open.";
  if (order.vendor_id !== advice.vendor_id) return "Cutting is not for your factory.";
  const { data: onCutting } = await supabase
    .from("cutting_order_products")
    .select("product_id")
    .eq("cutting_order_id", cuttingOrderId)
    .in("product_id", ids);
  const allowed = new Set((onCutting ?? []).map((p) => p.product_id));
  if (ids.some((id) => !allowed.has(id))) return "Product is not on that cutting.";
  const { data: inserted, error } = await supabase
    .from("vendor_advice_products")
    .insert(
      ids.map((product_id) => ({
        advice_id: adviceId,
        cutting_order_id: cuttingOrderId,
        product_id,
      })),
    )
    .select("id, product_id");
  if (error) {
    if (error.code === "23505") return "Already on this packing list.";
    return error.message;
  }
  const lineIds = (inserted ?? []).map((r) => r.id);
  const { data: qtys, error: qtyErr } = await supabase
    .from("cutting_quantities")
    .select("product_id, size_id, drop_id, qty_ordered, qty_received")
    .eq("cutting_order_id", cuttingOrderId)
    .in("product_id", ids);
  if (qtyErr) {
    if (lineIds.length) {
      await supabase.from("vendor_advice_products").delete().in("id", lineIds);
    }
    return qtyErr.message;
  }
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
        advice_product_id: line.id,
        size_id: q.size_id,
        drop_id: q.drop_id,
        qty: remaining,
      });
    }
  }
  if (cells.length) {
    const { error: cellErr } = await supabase.from("vendor_advice_cells").insert(cells);
    if (cellErr) {
      if (lineIds.length) {
        await supabase.from("vendor_advice_products").delete().in("id", lineIds);
      }
      return cellErr.message;
    }
  }
  revalidate();
  return null;
}

export async function deleteVendorAdviceProduct(lineId: string) {
  const supabase = await createClient();
  const { data: line } = await supabase
    .from("vendor_advice_products")
    .select("id, advice_id")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return "Line not found.";
  const opened = await requireDraft(line.advice_id);
  if (opened.error) return opened.error;
  const { error } = await supabase.from("vendor_advice_products").delete().eq("id", lineId);
  if (error) return error.message;
  revalidate();
  return null;
}

export async function saveVendorAdviceLine(lineId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: line } = await supabase
    .from("vendor_advice_products")
    .select("id, advice_id")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return "Line not found.";
  const opened = await requireDraft(line.advice_id);
  if (opened.error) return opened.error;
  const cells = parseCellFields(formData, "adv");
  const keep = [
    ...new Set(
      [...formData.keys()]
        .filter((k) => k.startsWith("keepDrop:"))
        .map((k) => k.slice("keepDrop:".length))
        .filter(Boolean),
    ),
  ];
  if (cells.length) {
    const { error } = await supabase.from("vendor_advice_cells").upsert(
      cells.map((c) => ({
        advice_product_id: lineId,
        size_id: c.size_id,
        drop_id: c.drop_id,
        qty: c.qty,
      })),
      { onConflict: "advice_product_id,size_id,drop_id" },
    );
    if (error) return error.message;
  }
  let q = supabase.from("vendor_advice_cells").delete().eq("advice_product_id", lineId);
  if (keep.length) {
    q = q.not("drop_id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`);
  }
  const { error: delError } = await q;
  if (delError) return delError.message;
  revalidate();
  return null;
}

export async function acceptVendorAdvice(id: string) {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_vendor_advice", { p_advice_id: id });
  if (error) return error.message;
  revalidate();
  return null;
}

export async function returnVendorAdvice(id: string) {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_vendor_advice", { p_advice_id: id });
  if (error) return error.message;
  revalidate();
  return null;
}
