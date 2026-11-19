"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { parseCellFields } from "@/lib/products";

function revalidate() {
  revalidatePath("/draft-orders");
  revalidatePath("/my-orders");
}

async function openRequest(requestId: string) {
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_order_requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!data) return { supabase, error: "Order not found." };
  if (data.status === "accepted") return { supabase, error: "This order is already accepted." };
  return { supabase, error: null as string | null };
}

export async function addRequestProduct(
  requestId: string,
  productId: string,
  draft?: { price: number; upcharges: { size_id: string; drop_id: string; amount: number }[] },
) {
  if (!requestId) return "Open an order first.";
  if (!productId) return "Pick a product.";
  const { supabase, error: closed } = await openRequest(requestId);
  if (closed) return closed;
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
  const { error } = await supabase.from("customer_order_request_products").insert({
    request_id: requestId,
    product_id: productId,
    price,
    qty: null,
  });
  if (error) return error.code === "23505" ? "That product is already on the order." : error.message;
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
    .filter((row) => Number(row.upcharge_amount) > 0)
    .map((row) => ({
      request_id: requestId,
      product_id: productId,
      size_id: row.size_id,
      drop_id: row.drop_id,
      qty: 0,
      price: Number(row.upcharge_amount),
    }));
  if (rows.length) {
    const { error: cellError } = await supabase.from("customer_order_request_cells").insert(rows);
    if (cellError) return cellError.message;
  }
  revalidate();
  return null;
}

export async function addRequestCharge(requestId: string, productId: string, price: number, qty: number) {
  if (!requestId) return "Open an order first.";
  if (!productId) return "Pick a charge.";
  const { supabase, error: closed } = await openRequest(requestId);
  if (closed) return closed;
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
  const { error } = await supabase.from("customer_order_request_products").insert({
    request_id: requestId,
    product_id: productId,
    price,
    qty: nextQty,
  });
  if (error) return error.code === "23505" ? "That product is already on the order." : error.message;
  revalidate();
  return null;
}

export async function saveRequestCharge(
  requestId: string,
  productId: string,
  _status: string,
  price: number,
  qty: number,
) {
  const { supabase, error: closed } = await openRequest(requestId);
  if (closed) return closed;
  if (!Number.isFinite(price) || price < 0) return "Enter a price.";
  const { data: product } = await supabase.from("products").select("type").eq("id", productId).maybeSingle();
  if (!product || (product.type !== 2 && product.type !== 3)) return "That line is not a charge.";
  const freight = product.type === 3;
  const nextQty = freight ? 1 : Math.trunc(Number(qty));
  if (!freight && (!Number.isFinite(nextQty) || nextQty < 0)) return "Enter a quantity.";
  const { error } = await supabase
    .from("customer_order_request_products")
    .update({ price, qty: nextQty })
    .eq("request_id", requestId)
    .eq("product_id", productId);
  if (error) return error.message;
  revalidate();
  return null;
}

export async function saveRequestQty(
  requestId: string,
  productId: string,
  _status: string,
  formData: FormData,
) {
  const { supabase, error: closed } = await openRequest(requestId);
  if (closed) return closed;
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
    .from("customer_order_request_cells")
    .select("size_id, drop_id, price")
    .eq("request_id", requestId)
    .eq("product_id", productId);
  const prev = new Map((existing ?? []).map((cell) => [`${cell.size_id}:${cell.drop_id}`, cell]));
  const rows = cells
    .filter((cell) => keepSet.has(cell.drop_id))
    .map((cell) => {
      const old = prev.get(`${cell.size_id}:${cell.drop_id}`);
      return {
        request_id: requestId,
        product_id: productId,
        size_id: cell.size_id,
        drop_id: cell.drop_id,
        qty: Math.max(0, Number(cell.qty) || 0),
        price: old?.price ?? null,
      };
    });
  if (rows.length) {
    const { error } = await supabase.from("customer_order_request_cells").upsert(rows, {
      onConflict: "request_id,product_id,size_id,drop_id",
    });
    if (error) return error.message;
  }
  let removing = supabase
    .from("customer_order_request_cells")
    .delete()
    .eq("request_id", requestId)
    .eq("product_id", productId);
  if (keep.length) removing = removing.not("drop_id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`);
  const { error: delError } = await removing;
  if (delError) return delError.message;
  revalidate();
  return null;
}

export async function saveRequestPrice(
  requestId: string,
  productId: string,
  price: number,
  upcharges: { size_id: string; drop_id: string; amount: number }[],
) {
  const { supabase, error: closed } = await openRequest(requestId);
  if (closed) return closed;
  if (!Number.isFinite(price) || price < 0) return "Enter a price.";
  if (upcharges.some((row) => !row.size_id || !row.drop_id || !Number.isFinite(row.amount) || row.amount < 0)) {
    return "Enter a size extra of zero or more.";
  }
  const { error: lineError } = await supabase
    .from("customer_order_request_products")
    .update({ price })
    .eq("request_id", requestId)
    .eq("product_id", productId);
  if (lineError) return lineError.message;
  const { data: existing } = await supabase
    .from("customer_order_request_cells")
    .select("size_id, drop_id, qty")
    .eq("request_id", requestId)
    .eq("product_id", productId);
  const prev = new Map((existing ?? []).map((cell) => [`${cell.size_id}:${cell.drop_id}`, cell]));
  const rows = upcharges.flatMap((row) => {
    const old = prev.get(`${row.size_id}:${row.drop_id}`);
    const amount = Number(row.amount) || 0;
    if (amount <= 0 && !old) return [];
    return [
      {
        request_id: requestId,
        product_id: productId,
        size_id: row.size_id,
        drop_id: row.drop_id,
        qty: Number(old?.qty ?? 0),
        price: amount > 0 ? amount : null,
      },
    ];
  });
  if (rows.length) {
    const { error } = await supabase.from("customer_order_request_cells").upsert(rows, {
      onConflict: "request_id,product_id,size_id,drop_id",
    });
    if (error) return error.message;
  }
  revalidate();
  return null;
}

export async function removeRequestLine(requestId: string, productId: string) {
  const { supabase, error: closed } = await openRequest(requestId);
  if (closed) return closed;
  const { error } = await supabase
    .from("customer_order_request_products")
    .delete()
    .eq("request_id", requestId)
    .eq("product_id", productId);
  if (error) return error.message;
  revalidate();
  return null;
}

export async function pasteRequestCells(
  requestId: string,
  productId: string,
  cells: { size_id: string; drop_id: string; qty: number }[],
  itemId: string,
  sizeChartId: string,
  mode: "replace" | "combine" = "replace",
) {
  const derived = cells.filter((cell) => Number(cell.qty) > 0);
  if (!derived.length) return "That copy has no sized qty.";
  const { supabase, error: closed } = await openRequest(requestId);
  if (closed) return closed;
  const { data: line, error: lineError } = await supabase
    .from("customer_order_request_products")
    .select("product_id, products ( type, size_chart_id, models ( item_id ) )")
    .eq("request_id", requestId)
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
  const { data: sizeRows } = await supabase.from("product_sizes").select("size_id").eq("product_id", productId);
  const { data: dropRows } = await supabase.from("product_drops").select("drop_id").eq("product_id", productId);
  const sizeIds = new Set((sizeRows ?? []).map((row) => row.size_id));
  const dropIds = new Set((dropRows ?? []).map((row) => row.drop_id));
  const applied =
    mode === "combine"
      ? derived
      : derived.filter(
          (cell) =>
            (!sizeIds.size || sizeIds.has(cell.size_id)) && (!dropIds.size || dropIds.has(cell.drop_id)),
        );
  const { data: existing, error: existingError } = await supabase
    .from("customer_order_request_cells")
    .select("size_id, drop_id, qty, price")
    .eq("request_id", requestId)
    .eq("product_id", productId);
  if (existingError) return existingError.message;
  const prev = new Map((existing ?? []).map((cell) => [`${cell.size_id}:${cell.drop_id}`, cell]));
  if (mode === "combine" && applied.length) {
    const newSizes = [...new Set(applied.map((cell) => cell.size_id))].filter((id) => !sizeIds.has(id));
    const newDrops = [...new Set(applied.map((cell) => cell.drop_id))].filter((id) => !dropIds.has(id));
    if (newSizes.length) {
      const { error } = await supabase
        .from("product_sizes")
        .insert(newSizes.map((size_id) => ({ product_id: productId, size_id })));
      if (error && error.code !== "23505") return error.message;
    }
    if (newDrops.length) {
      const { error } = await supabase
        .from("product_drops")
        .insert(newDrops.map((drop_id) => ({ product_id: productId, drop_id })));
      if (error && error.code !== "23505") return error.message;
    }
    if (newSizes.length || newDrops.length) {
      const { error: sync } = await supabase.rpc("sync_product_inventory", { p_product_id: productId });
      if (sync) return sync.message;
    }
  }
  const rows = applied.map((cell) => {
    const old = prev.get(`${cell.size_id}:${cell.drop_id}`);
    const nextQty = mode === "combine" ? Number(old?.qty ?? 0) + Number(cell.qty) : Number(cell.qty);
    return {
      request_id: requestId,
      product_id: productId,
      size_id: cell.size_id,
      drop_id: cell.drop_id,
      qty: nextQty,
      price: old?.price ?? null,
    };
  });
  if (rows.length) {
    const { error } = await supabase.from("customer_order_request_cells").upsert(rows, {
      onConflict: "request_id,product_id,size_id,drop_id",
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
          .from("customer_order_request_cells")
          .update({ qty: 0 })
          .eq("request_id", requestId)
          .eq("product_id", productId)
          .eq("size_id", cell.size_id)
          .eq("drop_id", cell.drop_id);
        if (error) return error.message;
        continue;
      }
      const { error } = await supabase
        .from("customer_order_request_cells")
        .delete()
        .eq("request_id", requestId)
        .eq("product_id", productId)
        .eq("size_id", cell.size_id)
        .eq("drop_id", cell.drop_id);
      if (error) return error.message;
    }
  }
  revalidate();
  return null;
}
