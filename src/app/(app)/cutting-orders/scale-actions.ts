"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toSentenceCase } from "@/lib/text-case";

export type SizeDropScaleCell = {
  size_id: string;
  drop_id: string;
  percent: number;
};

export type SizeDropScale = {
  id: string;
  name: string;
  last_updated: string | null;
  cells: SizeDropScaleCell[];
};

async function lineScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  productId: string,
) {
  const { data, error } = await supabase
    .from("cutting_order_products")
    .select(
      "product_id, products ( size_chart_id, lots ( brand_id ), models ( item_id ) )",
    )
    .eq("cutting_order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) return { error: error.message };
  const product = Array.isArray(data?.products) ? data.products[0] : data?.products;
  const lot = Array.isArray(product?.lots) ? product.lots[0] : product?.lots;
  const model = Array.isArray(product?.models) ? product.models[0] : product?.models;
  const brand_id = (lot as { brand_id?: string | null } | null)?.brand_id ?? null;
  const item_id = (model as { item_id?: string | null } | null)?.item_id ?? null;
  const size_chart_id = (product as { size_chart_id?: string | null } | null)?.size_chart_id ?? null;
  if (!brand_id || !item_id || !size_chart_id) {
    return { error: "This product needs a brand, item, and size chart." };
  }
  const { data: subset } = await supabase
    .from("product_sizes")
    .select("size_id")
    .eq("product_id", productId);
  const { data: drops } = await supabase
    .from("product_drops")
    .select("drop_id")
    .eq("product_id", productId);
  return {
    brand_id,
    item_id,
    size_chart_id,
    sizeIds: new Set((subset ?? []).map((s) => s.size_id)),
    dropIds: new Set((drops ?? []).map((d) => d.drop_id)),
  };
}

export type SizedQtyCell = { size_id: string; drop_id: string; qty: number };

async function writeLineQtyCells(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  productId: string,
  scope: Exclude<Awaited<ReturnType<typeof lineScope>>, { error: string }>,
  derived: SizedQtyCell[],
  mode: "replace" | "combine",
) {
  const applied =
    mode === "combine"
      ? derived
      : derived.filter(
          (c) =>
            (!scope.sizeIds.size || scope.sizeIds.has(c.size_id)) &&
            (!scope.dropIds.size || scope.dropIds.has(c.drop_id)),
        );
  if (mode === "combine" && applied.length) {
    const newSizes = [...new Set(applied.map((c) => c.size_id))].filter(
      (id) => !scope.sizeIds.has(id),
    );
    const newDrops = [...new Set(applied.map((c) => c.drop_id))].filter(
      (id) => !scope.dropIds.has(id),
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
  const { data: existing, error: exErr } = await supabase
    .from("cutting_quantities")
    .select("id, size_id, drop_id, qty_ordered, qty_received")
    .eq("cutting_order_id", orderId)
    .eq("product_id", productId);
  if (exErr) return exErr.message;
  const received = new Map(
    (existing ?? []).map((r) => [`${r.size_id}:${r.drop_id}`, Number(r.qty_received ?? 0)]),
  );
  const ordered = new Map(
    (existing ?? []).map((r) => [`${r.size_id}:${r.drop_id}`, Number(r.qty_ordered ?? 0)]),
  );
  const rows =
    mode === "combine"
      ? applied.map((c) => {
          const key = `${c.size_id}:${c.drop_id}`;
          return {
            cutting_order_id: orderId,
            product_id: productId,
            size_id: c.size_id,
            drop_id: c.drop_id,
            qty_ordered: (ordered.get(key) ?? 0) + c.qty,
            qty_received: received.get(key) ?? 0,
          };
        })
      : applied.map((c) => ({
          cutting_order_id: orderId,
          product_id: productId,
          size_id: c.size_id,
          drop_id: c.drop_id,
          qty_ordered: c.qty,
          qty_received: received.get(`${c.size_id}:${c.drop_id}`) ?? 0,
        }));
  if (rows.length) {
    const { error } = await supabase.from("cutting_quantities").upsert(rows, {
      onConflict: "cutting_order_id,product_id,size_id,drop_id",
    });
    if (error) return error.message;
  }
  if (mode === "replace") {
    const keep = new Set(applied.map((c) => `${c.size_id}:${c.drop_id}`));
    const gone = (existing ?? [])
      .filter((r) => !keep.has(`${r.size_id}:${r.drop_id}`))
      .map((r) => r.id);
    if (gone.length) {
      const { error } = await supabase.from("cutting_quantities").delete().in("id", gone);
      if (error) return error.message;
    }
  }
  revalidatePath("/cutting-orders");
  revalidatePath(`/cutting-orders/${orderId}`);
  revalidatePath("/products");
  revalidatePath("/inventory");
  return null;
}

export async function pasteSizedCells(
  orderId: string,
  productId: string,
  cells: SizedQtyCell[],
  itemId: string,
  sizeChartId: string,
  mode: "replace" | "combine" = "replace",
) {
  const derived = cells.filter((c) => Number(c.qty) > 0);
  if (!derived.length) return "That copy has no sized qty.";
  const supabase = await createClient();
  const scope = await lineScope(supabase, orderId, productId);
  if ("error" in scope) return scope.error;
  if (scope.item_id !== itemId || scope.size_chart_id !== sizeChartId) {
    return "That copy does not match this product’s item and size chart.";
  }
  return writeLineQtyCells(supabase, orderId, productId, scope, derived, mode);
}

export async function listSizeDropScales(
  brandId: string,
  itemId: string,
  sizeChartId: string,
): Promise<SizeDropScale[] | { error: string }> {
  if (!brandId || !itemId || !sizeChartId) return { error: "Missing product settings." };
  const supabase = await createClient();
  const { data: scales, error } = await supabase
    .from("size_drop_scales")
    .select("id, name, last_updated, size_drop_scale_cells ( size_id, drop_id, percent )")
    .eq("brand_id", brandId)
    .eq("item_id", itemId)
    .eq("size_chart_id", sizeChartId)
    .order("name");
  if (error) return { error: error.message };
  return (scales ?? []).map((s) => {
    const cells = (
      Array.isArray(s.size_drop_scale_cells) ? s.size_drop_scale_cells : []
    ) as SizeDropScaleCell[];
    return {
      id: s.id,
      name: s.name,
      last_updated: s.last_updated ? String(s.last_updated).slice(0, 10) : null,
      cells: cells.map((c) => ({
        size_id: c.size_id,
        drop_id: c.drop_id,
        percent: Number(c.percent ?? 0),
      })),
    };
  });
}

async function stampScaleFromLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scaleId: string,
  orderId: string,
  productId: string,
) {
  const { data: qtys, error: qtyErr } = await supabase
    .from("cutting_quantities")
    .select("size_id, drop_id, qty_ordered")
    .eq("cutting_order_id", orderId)
    .eq("product_id", productId);
  if (qtyErr) return qtyErr.message;
  const total = (qtys ?? []).reduce((s, q) => s + Number(q.qty_ordered ?? 0), 0);
  if (total <= 0) return "Size the grid first, then save, then update the scale.";
  await supabase.from("size_drop_scale_cells").delete().eq("scale_id", scaleId);
  const cells = (qtys ?? [])
    .filter((q) => Number(q.qty_ordered ?? 0) > 0)
    .map((q) => ({
      scale_id: scaleId,
      size_id: q.size_id,
      drop_id: q.drop_id,
      percent: (Number(q.qty_ordered) / total) * 100,
    }));
  if (!cells.length) return "Size the grid first, then save, then update the scale.";
  const { error: cellErr } = await supabase.from("size_drop_scale_cells").insert(cells);
  if (cellErr) return cellErr.message;
  const { error: touchErr } = await supabase
    .from("size_drop_scales")
    .update({ last_updated: new Date().toISOString().slice(0, 10) })
    .eq("id", scaleId);
  if (touchErr) return touchErr.message;
  return null;
}

export async function createSizeDropScaleFromLine(
  orderId: string,
  productId: string,
  name: string,
) {
  const trimmed = toSentenceCase(name.trim());
  if (!trimmed) return "Enter a name.";
  const supabase = await createClient();
  const scope = await lineScope(supabase, orderId, productId);
  if ("error" in scope) return scope.error;
  const { data: scale, error: insErr } = await supabase
    .from("size_drop_scales")
    .insert({
      name: trimmed,
      brand_id: scope.brand_id,
      item_id: scope.item_id,
      size_chart_id: scope.size_chart_id,
    })
    .select("id")
    .single();
  if (insErr?.code === "23505") return "That name already exists for this brand.";
  if (insErr || !scale) return insErr?.message ?? "Could not save the scale.";
  const stampErr = await stampScaleFromLine(supabase, scale.id, orderId, productId);
  if (stampErr) {
    await supabase.from("size_drop_scales").delete().eq("id", scale.id);
    return stampErr === "Size the grid first, then save, then update the scale."
      ? "Size the grid first, then save, then add the scale."
      : stampErr;
  }
  revalidatePath("/cutting-orders");
  return null;
}

export async function updateSizeDropScaleFromLine(
  orderId: string,
  productId: string,
  scaleId: string,
) {
  const supabase = await createClient();
  const scope = await lineScope(supabase, orderId, productId);
  if ("error" in scope) return scope.error;
  const { data: scale, error } = await supabase
    .from("size_drop_scales")
    .select("id, brand_id, item_id, size_chart_id")
    .eq("id", scaleId)
    .maybeSingle();
  if (error) return error.message;
  if (!scale) return "Scale not found.";
  if (
    scale.brand_id !== scope.brand_id ||
    scale.item_id !== scope.item_id ||
    scale.size_chart_id !== scope.size_chart_id
  ) {
    return "That scale does not match this product.";
  }
  const stampErr = await stampScaleFromLine(supabase, scaleId, orderId, productId);
  if (stampErr) return stampErr;
  revalidatePath("/cutting-orders");
  return null;
}

export async function deleteSizeDropScale(scaleId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("size_drop_scales").delete().eq("id", scaleId);
  if (error) return error.message;
  revalidatePath("/cutting-orders");
  return null;
}

export async function applySizeDropScale(
  orderId: string,
  productId: string,
  scaleId: string,
  qtyToDistribute: number,
  mode: "replace" | "combine" = "replace",
) {
  if (!Number.isInteger(qtyToDistribute) || qtyToDistribute < 0) {
    return "Qty to distribute must be a whole number.";
  }
  const supabase = await createClient();
  const scope = await lineScope(supabase, orderId, productId);
  if ("error" in scope) return scope.error;
  const { data: scale, error: scaleErr } = await supabase
    .from("size_drop_scales")
    .select(
      "id, brand_id, item_id, size_chart_id, size_drop_scale_cells ( size_id, drop_id, percent )",
    )
    .eq("id", scaleId)
    .maybeSingle();
  if (scaleErr) return scaleErr.message;
  if (!scale) return "Scale not found.";
  if (
    scale.brand_id !== scope.brand_id ||
    scale.item_id !== scope.item_id ||
    scale.size_chart_id !== scope.size_chart_id
  ) {
    return "That scale does not match this product.";
  }
  const raw = (
    Array.isArray(scale.size_drop_scale_cells) ? scale.size_drop_scale_cells : []
  ) as SizeDropScaleCell[];
  const derived = raw
    .map((c) => ({
      size_id: c.size_id,
      drop_id: c.drop_id,
      qty: Math.round((qtyToDistribute * Number(c.percent ?? 0)) / 100),
    }))
    .filter((c) => c.qty > 0);
  return writeLineQtyCells(supabase, orderId, productId, scope, derived, mode);
}
