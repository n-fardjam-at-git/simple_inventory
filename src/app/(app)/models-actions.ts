"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addModel(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("models").insert({
    name: String(formData.get("name")),
    item_id: String(formData.get("item_id")),
    brand_id: String(formData.get("brand_id") || "") || null,
    size_chart_id: String(formData.get("size_chart_id")),
  });
  revalidatePath("/models");
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
  });
  revalidatePath("/lots");
}
