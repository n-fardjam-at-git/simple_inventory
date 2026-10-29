"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toBrandCase } from "@/lib/text-case";

function parseAverageConsumption(raw: unknown) {
  const text = String(raw ?? "").trim();
  if (!text) return { value: null as number | null };
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) {
    return { error: "Avg consumption must be a number 0 or more, with up to 2 decimals." };
  }
  return { value: Math.round(n * 100) / 100 };
}

export async function addModel(formData: FormData) {
  const parsed = parseAverageConsumption(formData.get("average_consumption"));
  if ("error" in parsed) return parsed.error;
  const supabase = await createClient();
  const { error } = await supabase.from("models").insert({
    name: toBrandCase(String(formData.get("name") ?? "").trim()),
    item_id: String(formData.get("item_id")),
    size_chart_id: String(formData.get("size_chart_id")),
    average_consumption: parsed.value,
  });
  if (error) return error.message;
  revalidatePath("/models");
  return null;
}

export async function addLot(formData: FormData) {
  const supabase = await createClient();
  const lot_no = String(formData.get("lot_no"));
  const parts = lot_no.split("-");
  await supabase.from("lots").insert({
    lot_no,
    article: parts[0] || null,
    color_num: parts[1] || null,
    brand_id: String(formData.get("brand_id") || "") || null,
    color_id: String(formData.get("color_id") || "") || null,
    pattern_id: String(formData.get("pattern_id") || "") || null,
    content_id: String(formData.get("content_id") || "") || null,
  });
  revalidatePath("/lots");
}

export async function updateLotLookups(
  lotId: string,
  values: {
    color_id: string;
    pattern_id: string;
    content_id: string;
    brand_id: string;
    mill_article: string;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lots")
    .update({
      color_id: values.color_id || null,
      pattern_id: values.pattern_id || null,
      content_id: values.content_id || null,
      brand_id: values.brand_id || null,
      mill_article: values.mill_article.trim() || null,
    })
    .eq("id", lotId);
  if (error) return error.message;
  revalidatePath("/lots");
  return null;
}

export async function deleteLot(lotId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lots").delete().eq("id", lotId);
  if (error) return error.message;
  revalidatePath("/lots");
  return null;
}

export async function updateModel(
  modelId: string,
  values: {
    name: string;
    item_id: string;
    size_chart_id: string;
    is_active: boolean;
    average_consumption: string;
  },
) {
  const parsed = parseAverageConsumption(values.average_consumption);
  if ("error" in parsed) return parsed.error;
  const supabase = await createClient();
  const { error } = await supabase
    .from("models")
    .update({
      name: toBrandCase(values.name.trim()),
      item_id: values.item_id,
      size_chart_id: values.size_chart_id,
      is_active: values.is_active,
      average_consumption: parsed.value,
    })
    .eq("id", modelId);
  if (error) return error.message;
  revalidatePath("/models");
  revalidatePath("/products");
  return null;
}

export async function deleteModel(modelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("models").delete().eq("id", modelId);
  if (error) return error.message;
  revalidatePath("/models");
  return null;
}
