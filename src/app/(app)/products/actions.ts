"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCellFields } from "@/lib/products";

export async function savePrices(productId: string, formData: FormData) {
  const supabase = await createClient();
  const price = Number(formData.get("standard_price") ?? 0);
  await supabase.from("products").update({ standard_price: price }).eq("id", productId);
  const cells = parseCellFields(formData, "up");
  await supabase.from("product_price_upcharges").delete().eq("product_id", productId);
  const rows = cells
    .filter((c) => c.qty > 0)
    .map((c) => ({
      product_id: productId,
      size_id: c.size_id,
      drop_id: c.drop_id,
      upcharge_amount: c.qty,
    }));
  if (rows.length) await supabase.from("product_price_upcharges").insert(rows);
  revalidatePath(`/products/${productId}`);
}

export async function applyUpchargeColumn(productId: string, formData: FormData) {
  const supabase = await createClient();
  const sizeId = String(formData.get("size_id"));
  const amount = Number(formData.get("amount") ?? 0);
  const { data: drops } = await supabase
    .from("product_drops")
    .select("drop_id")
    .eq("product_id", productId);
  for (const d of drops ?? []) {
    await supabase.from("product_price_upcharges").upsert({
      product_id: productId,
      size_id: sizeId,
      drop_id: d.drop_id,
      upcharge_amount: amount,
    });
  }
  revalidatePath(`/products/${productId}`);
}

export async function applyUpchargeRow(productId: string, formData: FormData) {
  const supabase = await createClient();
  const dropId = String(formData.get("drop_id"));
  const amount = Number(formData.get("amount") ?? 0);
  const { data: sizes } = await supabase
    .from("product_sizes")
    .select("size_id")
    .eq("product_id", productId);
  for (const s of sizes ?? []) {
    await supabase.from("product_price_upcharges").upsert({
      product_id: productId,
      size_id: s.size_id,
      drop_id: dropId,
      upcharge_amount: amount,
    });
  }
  revalidatePath(`/products/${productId}`);
}

export async function saveSubset(productId: string, formData: FormData) {
  const supabase = await createClient();
  const sizeIds = formData.getAll("size_id").map(String);
  const dropIds = formData.getAll("drop_id").map(String);
  await supabase.from("product_sizes").delete().eq("product_id", productId);
  await supabase.from("product_drops").delete().eq("product_id", productId);
  if (sizeIds.length)
    await supabase.from("product_sizes").insert(
      sizeIds.map((size_id) => ({ product_id: productId, size_id })),
    );
  if (dropIds.length)
    await supabase.from("product_drops").insert(
      dropIds.map((drop_id) => ({ product_id: productId, drop_id })),
    );
  await supabase.rpc("sync_product_inventory", { p_product_id: productId });
  revalidatePath(`/products/${productId}`);
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  const lot_id = String(formData.get("lot_id"));
  const model_id = String(formData.get("model_id"));
  const { data: model } = await supabase
    .from("models")
    .select("size_chart_id")
    .eq("id", model_id)
    .single();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      lot_id,
      model_id,
      size_chart_id: model!.size_chart_id,
      standard_price: Number(formData.get("standard_price") ?? 0),
      published: true,
    })
    .select("id")
    .single();
  if (error || !product) throw new Error(error?.message ?? "create failed");
  const sizeIds = formData.getAll("size_id").map(String);
  const dropIds = formData.getAll("drop_id").map(String);
  if (sizeIds.length)
    await supabase.from("product_sizes").insert(
      sizeIds.map((size_id) => ({ product_id: product.id, size_id })),
    );
  if (dropIds.length)
    await supabase.from("product_drops").insert(
      dropIds.map((drop_id) => ({ product_id: product.id, drop_id })),
    );
  await supabase.rpc("sync_product_inventory", { p_product_id: product.id });
  redirect(`/products/${product.id}`);
}

export async function adjustCell(productId: string, formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("adjust_inventory", {
    p_product_id: productId,
    p_size_id: String(formData.get("size_id")),
    p_drop_id: String(formData.get("drop_id")),
    p_qty: Number(formData.get("qty")),
    p_notes: String(formData.get("notes") ?? "adjust"),
  });
  revalidatePath(`/products/${productId}`);
}
