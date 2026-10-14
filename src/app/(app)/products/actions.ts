"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCellFields } from "@/lib/products";
import { INSTOCK, parseAvailabilityValue } from "@/lib/season";
import { toSentenceCase } from "@/lib/text-case";
import { resolveProductDropIds } from "@/lib/size-code";

export async function savePrices(productId: string, formData: FormData) {
  const supabase = await createClient();
  const price = Number(formData.get("standard_price") ?? 0);
  await supabase.from("products").update({ standard_price: price }).eq("id", productId);
  const hasUp = [...formData.keys()].some((k) => k.startsWith("up:"));
  if (hasUp) {
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
  }
  revalidatePath(`/products/${productId}`);
  revalidatePath("/inventory");
}

export async function saveSubset(
  productId: string,
  sizeIdsIn: string[],
  dropIdsIn: string[],
) {
  const supabase = await createClient();
  const requestedSizes = new Set(sizeIdsIn.filter(Boolean));
  const requestedDrops = new Set(dropIdsIn.filter(Boolean));

  const { data: inv } = await supabase
    .from("inventory")
    .select("size_id, drop_id, qty_on_hand")
    .eq("product_id", productId);
  for (const row of inv ?? []) {
    if (Number(row.qty_on_hand) > 0) {
      requestedSizes.add(row.size_id);
      requestedDrops.add(row.drop_id);
    }
  }

  const sizeIds = [...requestedSizes];
  if (!sizeIds.length) return "Pick at least one size.";

  const { data: product } = await supabase
    .from("products")
    .select("size_chart_id")
    .eq("id", productId)
    .single();
  const { data: chartDrops } = product?.size_chart_id
    ? await supabase
        .from("size_chart_drops")
        .select("id, code")
        .eq("chart_id", product.size_chart_id)
    : { data: [] as { id: string; code: string }[] };
  const resolved = resolveProductDropIds(chartDrops ?? [], [...requestedDrops]);
  if (resolved.error) return resolved.error;
  const dropIds = resolved.ids;

  const { error: delS } = await supabase
    .from("product_sizes")
    .delete()
    .eq("product_id", productId);
  if (delS) return delS.message;
  const { error: delD } = await supabase
    .from("product_drops")
    .delete()
    .eq("product_id", productId);
  if (delD) return delD.message;
  const { error: insS } = await supabase.from("product_sizes").insert(
    sizeIds.map((size_id) => ({ product_id: productId, size_id })),
  );
  if (insS) return insS.message;
  const { error: insD } = await supabase.from("product_drops").insert(
    dropIds.map((drop_id) => ({ product_id: productId, drop_id })),
  );
  if (insD) return insD.message;
  const { error: sync } = await supabase.rpc("sync_product_inventory", {
    p_product_id: productId,
  });
  if (sync) return sync.message;
  revalidatePath(`/products/${productId}`);
  revalidatePath("/inventory");
  return null;
}

async function resolveAvailability(raw: unknown) {
  const value = parseAvailabilityValue(raw);
  if (!value) return null;
  if (value === INSTOCK) return INSTOCK;
  const supabase = await createClient();
  const { data } = await supabase.from("seasons").select("season").eq("season", value).maybeSingle();
  return data?.season ?? null;
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  const type = Number(formData.get("type") ?? 1);
  const price = Number(formData.get("standard_price") ?? 0);

  if (type === 2 || type === 3) {
    const { data: product, error } = await supabase
      .from("products")
      .insert({
        type,
        name: toSentenceCase(String(formData.get("name") ?? "").trim()),
        lot_id: null,
        model_id: null,
        size_chart_id: null,
        standard_price: price,
        published: true,
      })
      .select("id")
      .single();
    if (error?.message?.includes("products_one_freight") || error?.code === "23505") {
      redirect(
        "/products/charges/new?error=" +
          encodeURIComponent("Freight already exists. There can be only one freight product."),
      );
    }
    if (error || !product) {
      redirect(
        `/products/charges/new?error=${encodeURIComponent(error?.message ?? "create failed")}`,
      );
    }
    revalidatePath("/products/charges");
    redirect("/products/charges");
  }

  const lot_id = String(formData.get("lot_id"));
  const model_id = String(formData.get("model_id"));
  const rawStage = Number(formData.get("price_stage") ?? 1);
  const price_stage = rawStage === 2 || rawStage === 3 ? rawStage : 1;
  const availability = await resolveAvailability(formData.get("availability"));
  const collection_id = String(formData.get("collection_id") || "") || null;
  const { data: model } = await supabase
    .from("models")
    .select("size_chart_id")
    .eq("id", model_id)
    .single();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      type: 1,
      lot_id,
      model_id,
      size_chart_id: model!.size_chart_id,
      standard_price: price,
      price_stage,
      availability,
      collection_id,
      published: true,
    })
    .select("id")
    .single();
  if (error?.code === "23505" || error?.message?.includes("products_lot_id_model_id_key") || error?.message?.includes("products_name_key")) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("lot_id", lot_id)
      .eq("model_id", model_id)
      .maybeSingle();
    if (existing) redirect(`/products/${existing.id}?notice=exists`);
    redirect("/products/new?error=exists");
  }
  if (error || !product) redirect(`/products/new?error=${encodeURIComponent(error?.message ?? "create failed")}`);
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

export async function updateProductRow(
  productId: string,
  values: {
    name?: string;
    standard_price: number;
    is_active: boolean;
    price_stage?: number;
    availability?: string | null;
    collection_id?: string | null;
  },
) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    standard_price: values.standard_price,
    is_active: values.is_active,
  };
  if (values.name !== undefined) patch.name = toSentenceCase(values.name.trim());
  if (values.price_stage !== undefined) {
    patch.price_stage =
      values.price_stage === 2 || values.price_stage === 3 ? values.price_stage : 1;
  }
  if (values.availability !== undefined) {
    patch.availability = await resolveAvailability(values.availability);
  }
  if (values.collection_id !== undefined) {
    patch.collection_id = values.collection_id || null;
  }
  const { error } = await supabase.from("products").update(patch).eq("id", productId);
  if (error) return error.message;
  revalidatePath("/products");
  revalidatePath("/products/charges");
  revalidatePath("/inventory");
  return null;
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return error.message;
  revalidatePath("/products");
  revalidatePath("/products/charges");
  revalidatePath("/inventory");
  revalidatePath("/lots");
  return null;
}
