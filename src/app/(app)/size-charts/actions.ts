"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addChart(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("size_charts").insert({ name: String(formData.get("name")) });
  revalidatePath("/size-charts");
}

export async function addSize(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("size_chart_sizes").insert({
    chart_id: String(formData.get("chart_id")),
    code: String(formData.get("code")),
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  revalidatePath("/size-charts");
}

export async function addDrop(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("size_chart_drops").insert({
    chart_id: String(formData.get("chart_id")),
    code: String(formData.get("code")),
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  revalidatePath("/size-charts");
}
