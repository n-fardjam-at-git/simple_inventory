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
  const template_id = String(formData.get("template_id") || "").trim() || null;
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
      template_id,
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
    if (existing) redirect("/products/new?error=exists");
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
  const sizeSet = new Set(sizeIds);
  const dropSet = new Set(dropIds);
  const upRows = parseCellFields(formData, "up")
    .filter((c) => c.qty > 0 && sizeSet.has(c.size_id) && (!dropSet.size || dropSet.has(c.drop_id)))
    .map((c) => ({
      product_id: product.id,
      size_id: c.size_id,
      drop_id: c.drop_id,
      upcharge_amount: c.qty,
    }));
  if (upRows.length) await supabase.from("product_price_upcharges").insert(upRows);
  await supabase.rpc("sync_product_inventory", { p_product_id: product.id });
  revalidatePath("/products");
  revalidatePath("/inventory");
  redirect("/products");
}

export async function createMerchandiseProduct(formData: FormData) {
  const supabase = await createClient();
  const lot_id = String(formData.get("lot_id") || "").trim();
  const model_id = String(formData.get("model_id") || "").trim();
  if (!lot_id) return "Pick a lot.";
  if (!model_id) return "Pick a model.";
  const sizeIds = formData.getAll("size_id").map(String).filter(Boolean);
  const dropIds = formData.getAll("drop_id").map(String).filter(Boolean);
  if (!sizeIds.length) return "Pick at least one size.";
  const price = Number(formData.get("standard_price") ?? 0);
  const rawStage = Number(formData.get("price_stage") ?? 1);
  const price_stage = rawStage === 2 || rawStage === 3 ? rawStage : 1;
  const availability = await resolveAvailability(formData.get("availability"));
  const collection_id = String(formData.get("collection_id") || "") || null;
  const { data: model } = await supabase
    .from("models")
    .select("size_chart_id")
    .eq("id", model_id)
    .single();
  if (!model?.size_chart_id) return "Pick a model.";
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      type: 1,
      lot_id,
      model_id,
      size_chart_id: model.size_chart_id,
      standard_price: price,
      price_stage,
      availability,
      collection_id,
      published: true,
    })
    .select("id")
    .single();
  if (error?.code === "23505" || error?.message?.includes("products_lot_id_model_id_key")) {
    return "That lot and model already exist as a product.";
  }
  if (error || !product) return error?.message ?? "Could not create product.";
  await supabase.from("product_sizes").insert(
    sizeIds.map((size_id) => ({ product_id: product.id, size_id })),
  );
  if (dropIds.length) {
    await supabase.from("product_drops").insert(
      dropIds.map((drop_id) => ({ product_id: product.id, drop_id })),
    );
  }
  const sizeSet = new Set(sizeIds);
  const dropSet = new Set(dropIds);
  const upRows = parseCellFields(formData, "up")
    .filter((c) => c.qty > 0 && sizeSet.has(c.size_id) && (!dropSet.size || dropSet.has(c.drop_id)))
    .map((c) => ({
      product_id: product.id,
      size_id: c.size_id,
      drop_id: c.drop_id,
      upcharge_amount: c.qty,
    }));
  if (upRows.length) await supabase.from("product_price_upcharges").insert(upRows);
  await supabase.rpc("sync_product_inventory", { p_product_id: product.id });
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/cutting-orders");
  return null;
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

export type ProductEditDetail = {
  chartSizes: { id: string; code: string; sort_order: number }[];
  chartDrops: { id: string; code: string; sort_order: number }[];
  selectedSizeIds: string[];
  selectedDropIds: string[];
  cells: { size_id: string; drop_id: string; qty: number; upcharge: number }[];
};

export async function loadProductEdit(
  productId: string,
): Promise<{ detail: ProductEditDetail | null; error: string | null }> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("id, type, size_chart_id")
    .eq("id", productId)
    .maybeSingle();
  if (error) return { detail: null, error: error.message };
  if (!product || product.type !== 1) return { detail: null, error: "Merchandise only." };
  const chartId = product.size_chart_id as string | null;
  const { data: chartSizes } = chartId
    ? await supabase
        .from("size_chart_sizes")
        .select("id, code, sort_order")
        .eq("chart_id", chartId)
        .order("sort_order")
    : { data: [] as ProductEditDetail["chartSizes"] };
  const { data: chartDrops } = chartId
    ? await supabase
        .from("size_chart_drops")
        .select("id, code, sort_order")
        .eq("chart_id", chartId)
        .order("sort_order")
    : { data: [] as ProductEditDetail["chartDrops"] };
  const { data: pSizes } = await supabase.from("product_sizes").select("size_id").eq("product_id", productId);
  const { data: pDrops } = await supabase.from("product_drops").select("drop_id").eq("product_id", productId);
  const { data: inventory } = await supabase
    .from("inventory")
    .select("size_id, drop_id, qty_on_hand")
    .eq("product_id", productId);
  const { data: upcharges } = await supabase
    .from("product_price_upcharges")
    .select("size_id, drop_id, upcharge_amount")
    .eq("product_id", productId);
  const upMap = new Map(
    (upcharges ?? []).map((u) => [`${u.size_id}:${u.drop_id}`, Number(u.upcharge_amount)]),
  );
  return {
    detail: {
      chartSizes: (chartSizes ?? []) as ProductEditDetail["chartSizes"],
      chartDrops: (chartDrops ?? []) as ProductEditDetail["chartDrops"],
      selectedSizeIds: (pSizes ?? []).map((s) => s.size_id),
      selectedDropIds: (pDrops ?? []).map((d) => d.drop_id),
      cells: (inventory ?? []).map((i) => ({
        size_id: i.size_id,
        drop_id: i.drop_id,
        qty: Number(i.qty_on_hand ?? 0),
        upcharge: upMap.get(`${i.size_id}:${i.drop_id}`) ?? 0,
      })),
    },
    error: null,
  };
}

export async function saveMerchandiseProduct(productId: string, formData: FormData) {
  const rowMsg = await updateProductRow(productId, {
    standard_price: Number(formData.get("standard_price") ?? 0) || 0,
    is_active: formData.get("is_active") === "1",
    price_stage: Number(formData.get("price_stage") ?? 1),
    availability: String(formData.get("availability") || "") || null,
    collection_id: String(formData.get("collection_id") || "") || null,
  });
  if (rowMsg) return rowMsg;
  const sizeIds = formData.getAll("size_id").map(String).filter(Boolean);
  const dropIds = formData.getAll("drop_id").map(String).filter(Boolean);
  const subMsg = await saveSubset(productId, sizeIds, dropIds);
  if (subMsg) return subMsg;
  const hasUp = [...formData.keys()].some((k) => k.startsWith("up:"));
  if (hasUp) {
    const supabase = await createClient();
    const cells = parseCellFields(formData, "up");
    await supabase.from("product_price_upcharges").delete().eq("product_id", productId);
    const sizeSet = new Set(sizeIds);
    const dropSet = new Set(dropIds);
    const rows = cells
      .filter((c) => c.qty > 0 && sizeSet.has(c.size_id) && (!dropSet.size || dropSet.has(c.drop_id)))
      .map((c) => ({
        product_id: productId,
        size_id: c.size_id,
        drop_id: c.drop_id,
        upcharge_amount: c.qty,
      }));
    if (rows.length) await supabase.from("product_price_upcharges").insert(rows);
  }
  revalidatePath("/products");
  revalidatePath("/inventory");
  return null;
}

async function stampTemplateFromProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
  productId: string,
) {
  await supabase.from("product_template_upcharges").delete().eq("template_id", templateId);
  await supabase.from("product_template_sizes").delete().eq("template_id", templateId);
  await supabase.from("product_template_drops").delete().eq("template_id", templateId);

  const { data: sizes, error: sizeErr } = await supabase
    .from("product_sizes")
    .select("size_id")
    .eq("product_id", productId);
  if (sizeErr) return sizeErr.message;
  if (sizes?.length) {
    const { error } = await supabase.from("product_template_sizes").insert(
      sizes.map((s) => ({ template_id: templateId, size_id: s.size_id })),
    );
    if (error) return error.message;
  }

  const { data: drops, error: dropErr } = await supabase
    .from("product_drops")
    .select("drop_id")
    .eq("product_id", productId);
  if (dropErr) return dropErr.message;
  if (drops?.length) {
    const { error } = await supabase.from("product_template_drops").insert(
      drops.map((d) => ({ template_id: templateId, drop_id: d.drop_id })),
    );
    if (error) return error.message;
  }

  const sizeSet = new Set((sizes ?? []).map((s) => s.size_id));
  const dropSet = new Set((drops ?? []).map((d) => d.drop_id));
  const { data: ups, error: upErr } = await supabase
    .from("product_price_upcharges")
    .select("size_id, drop_id, upcharge_amount")
    .eq("product_id", productId);
  if (upErr) return upErr.message;
  const upRows = (ups ?? []).filter(
    (u) => sizeSet.has(u.size_id) && (!dropSet.size || dropSet.has(u.drop_id)),
  );
  if (upRows.length) {
    const { error } = await supabase.from("product_template_upcharges").insert(
      upRows.map((u) => ({
        template_id: templateId,
        size_id: u.size_id,
        drop_id: u.drop_id,
        upcharge_amount: u.upcharge_amount,
      })),
    );
    if (error) return error.message;
  }
  return null;
}

export async function saveProductAsTemplate(
  productId: string,
  name: string,
  templateId?: string | null,
) {
  const trimmed = name.trim();
  if (!templateId && !trimmed) return "Enter a name.";
  const supabase = await createClient();
  const { data: product, error: loadErr } = await supabase
    .from("products")
    .select("id, type, standard_price, size_chart_id, lots ( brand_id ), models ( item_id )")
    .eq("id", productId)
    .maybeSingle();
  if (loadErr) return loadErr.message;
  if (!product || product.type !== 1) return "Merchandise only.";
  const lot = Array.isArray(product.lots) ? product.lots[0] : product.lots;
  const model = Array.isArray(product.models) ? product.models[0] : product.models;
  const brand_id = (lot as { brand_id?: string | null } | null)?.brand_id ?? null;
  const item_id = (model as { item_id?: string | null } | null)?.item_id ?? null;
  if (!brand_id) return "Product has no brand.";
  if (!item_id) return "Product has no item.";
  if (!product.size_chart_id) return "Product has no size chart.";

  let id = templateId?.trim() || "";
  if (id) {
    const { data: existing, error } = await supabase
      .from("product_templates")
      .select("id, brand_id, item_id, size_chart_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return error.message;
    if (!existing) return "Template not found.";
    if (
      existing.brand_id !== brand_id ||
      existing.item_id !== item_id ||
      existing.size_chart_id !== product.size_chart_id
    ) {
      return "That template is for a different brand, item, or chart.";
    }
    const { error: priceErr } = await supabase
      .from("product_templates")
      .update({ standard_price: product.standard_price })
      .eq("id", id);
    if (priceErr) return priceErr.message;
  } else {
    const { data: tpl, error: insErr } = await supabase
      .from("product_templates")
      .insert({
        name: trimmed,
        brand_id,
        item_id,
        size_chart_id: product.size_chart_id,
        standard_price: product.standard_price,
      })
      .select("id")
      .single();
    if (insErr?.code === "23505") return "That name already exists.";
    if (insErr || !tpl) return insErr?.message ?? "Could not save template.";
    id = tpl.id;
  }

  const stampErr = await stampTemplateFromProduct(supabase, id, productId);
  if (stampErr) {
    if (!templateId) await supabase.from("product_templates").delete().eq("id", id);
    return stampErr;
  }

  const { error: linkErr } = await supabase
    .from("products")
    .update({ template_id: id })
    .eq("id", productId);
  if (linkErr) {
    if (!templateId) await supabase.from("product_templates").delete().eq("id", id);
    return linkErr.message;
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
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
