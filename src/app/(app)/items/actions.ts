"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toSentenceCase } from "@/lib/text-case";

function revalidateItems() {
  revalidatePath("/items");
  revalidatePath("/models");
}

export async function updateItem(
  id: string,
  values: {
    name: string;
    default_size_chart_id: string | null;
    is_active: boolean;
    in_set: boolean;
  },
) {
  const name = toSentenceCase(values.name.trim());
  if (!name) return "Enter an item name.";
  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({
      name,
      default_size_chart_id: values.default_size_chart_id,
      is_active: values.is_active,
      in_set: values.in_set,
    })
    .eq("id", id);
  if (error) return error.message;
  revalidateItems();
  return null;
}

export async function deleteItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) return error.message;
  revalidateItems();
  return null;
}
