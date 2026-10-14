"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseCellFields } from "@/lib/products";

export async function saveInventoryMatrix(productId: string, formData: FormData) {
  const supabase = await createClient();
  const next = parseCellFields(formData, "inv");
  const { data: current } = await supabase
    .from("inventory")
    .select("size_id, drop_id, qty_on_hand")
    .eq("product_id", productId);
  const prev = new Map(
    (current ?? []).map((c) => [`${c.size_id}:${c.drop_id}`, c.qty_on_hand]),
  );
  for (const cell of next) {
    const oldQty = prev.get(`${cell.size_id}:${cell.drop_id}`) ?? 0;
    const delta = cell.qty - oldQty;
    if (!delta) continue;
    await supabase.rpc("adjust_inventory", {
      p_product_id: productId,
      p_size_id: cell.size_id,
      p_drop_id: cell.drop_id,
      p_qty: delta,
      p_notes: "inventory matrix",
    });
  }
  revalidatePath("/inventory");
}
