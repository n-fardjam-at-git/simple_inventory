"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function insertNamed(
  table: "brands" | "vendors" | "items" | "lots",
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
      name: String(formData.get("name")),
      default_size_chart_id: String(formData.get("default_size_chart_id") || "") || null,
    });
    revalidatePath("/items");
    return;
  }
  if (table === "vendors") {
    await supabase.from("vendors").insert({
      name: String(formData.get("name")),
      notes: String(formData.get("notes") || "") || null,
    });
    revalidatePath("/vendors");
    return;
  }
  await supabase.from("brands").insert({ name: String(formData.get("name")) });
  revalidatePath("/brands");
}
