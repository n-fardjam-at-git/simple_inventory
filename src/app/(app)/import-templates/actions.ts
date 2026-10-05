"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveTemplate(formData: FormData) {
  const supabase = await createClient();
  const mappings = JSON.parse(String(formData.get("mappings") || "[]"));
  const id = String(formData.get("id") || "");
  const payload = {
    name: String(formData.get("name")),
    target: String(formData.get("target")),
    mappings,
  };
  if (id) {
    await supabase.from("import_templates").update(payload).eq("id", id);
  } else {
    await supabase.from("import_templates").insert(payload);
  }
  revalidatePath("/import-templates");
}
