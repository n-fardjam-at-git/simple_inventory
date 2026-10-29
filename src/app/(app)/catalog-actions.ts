"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toBrandCase, toSentenceCase } from "@/lib/text-case";

export async function insertNamed(
  table:
    | "brands"
    | "vendors"
    | "items"
    | "lots"
    | "colors"
    | "patterns"
    | "contents"
    | "collections",
  formData: FormData,
) {
  const supabase = await createClient();
  if (table === "lots") {
    await supabase.from("lots").insert({
      lot_no: String(formData.get("lot_no")),
      article: String(formData.get("article") || "") || null,
      color_num: String(formData.get("color_num") || "") || null,
      brand_id: String(formData.get("brand_id") || "") || null,
    });
    revalidatePath("/lots");
    return;
  }
  if (table === "items") {
    await supabase.from("items").insert({
      name: toSentenceCase(String(formData.get("name") ?? "").trim()),
      default_size_chart_id: String(formData.get("default_size_chart_id") || "") || null,
    });
    revalidatePath("/items");
    return;
  }
  if (table === "vendors") {
    await supabase.from("vendors").insert({
      name: toSentenceCase(String(formData.get("name") ?? "").trim()),
      notes: toSentenceCase(String(formData.get("notes") || "").trim()) || null,
    });
    revalidatePath("/vendors");
    return;
  }
  if (table === "contents") {
    await supabase.from("contents").insert({
      name: String(formData.get("name") ?? "").trim(),
    });
    revalidatePath("/lots");
    revalidatePath("/cutting-orders");
    return;
  }
  if (table === "collections") {
    await supabase.from("collections").insert({
      name: toSentenceCase(String(formData.get("name") ?? "").trim()),
    });
    revalidatePath("/collections");
    return;
  }
  if (table === "colors" || table === "patterns") {
    await supabase.from(table).insert({
      name: toSentenceCase(String(formData.get("name") ?? "").trim()),
    });
    revalidatePath("/lots");
    revalidatePath("/cutting-orders");
    return;
  }
  await supabase.from("brands").insert({
    name: toBrandCase(String(formData.get("name") ?? "").trim()),
  });
  revalidatePath("/brands");
}

const ACTIVE_TABLES = [
  "products",
  "customers",
  "models",
  "lots",
  "brands",
  "items",
  "vendors",
  "colors",
  "patterns",
  "contents",
  "collections",
] as const;

type ActiveTable = (typeof ACTIVE_TABLES)[number];

const ACTIVE_PATHS: Record<ActiveTable, string> = {
  products: "/products",
  customers: "/customers",
  models: "/models",
  lots: "/lots",
  brands: "/brands",
  items: "/items",
  vendors: "/vendors",
  colors: "/lots",
  patterns: "/lots",
  contents: "/lots",
  collections: "/collections",
};

const LOT_LOOKUP_COL = {
  colors: "color_id",
  patterns: "pattern_id",
  contents: "content_id",
} as const;

export async function setIsActive(table: ActiveTable, id: string, formData: FormData) {
  if (!ACTIVE_TABLES.includes(table)) return;
  const supabase = await createClient();
  const is_active = String(formData.get("is_active")) === "true";
  if (
    !is_active &&
    (table === "colors" || table === "patterns" || table === "contents")
  ) {
    const col = LOT_LOOKUP_COL[table];
    const { count } = await supabase
      .from("lots")
      .select("id", { count: "exact", head: true })
      .eq(col, id);
    if ((count ?? 0) === 0) {
      await supabase.from(table).delete().eq("id", id);
      revalidatePath("/lots");
      revalidatePath("/cutting-orders");
      return;
    }
  }
  await supabase.from(table).update({ is_active }).eq("id", id);
  revalidatePath(ACTIVE_PATHS[table]);
  if (table === "products") revalidatePath("/inventory");
  if (table === "colors" || table === "patterns" || table === "contents") {
    revalidatePath("/cutting-orders");
  }
}
