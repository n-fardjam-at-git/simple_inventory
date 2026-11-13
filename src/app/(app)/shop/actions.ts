"use server";

import { createClient } from "@/lib/supabase/server";
import { PRODUCT_TYPE } from "@/lib/product-type";
import type { MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";

export type AvailableSizes = {
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: { size_id: string; drop_id: string }[];
  upcharges: { size_id: string; drop_id: string; amount: number }[];
};

/** Which size/drop cells have on-hand quantity. Counts stay on the server. */
export async function loadAvailableSizes(productId: string): Promise<AvailableSizes | string> {
  if (!productId) return "Pick a product.";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sign in again.";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "customer") return "Sign in again.";

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("type", PRODUCT_TYPE.merchandise)
    .eq("is_active", true)
    .eq("published", true)
    .maybeSingle();
  if (productError) return productError.message;
  if (!product) return "That product is not in the shop.";

  const [{ data: rows, error }, { data: sizeRows }, { data: dropRows }, { data: upRows, error: upError }] =
    await Promise.all([
      supabase.from("inventory").select("size_id, drop_id, qty_on_hand").eq("product_id", productId),
      supabase
        .from("product_sizes")
        .select("size_chart_sizes ( id, code, sort_order )")
        .eq("product_id", productId),
      supabase
        .from("product_drops")
        .select("size_chart_drops ( id, code, sort_order )")
        .eq("product_id", productId),
      supabase
        .from("product_price_upcharges")
        .select("size_id, drop_id, upcharge_amount")
        .eq("product_id", productId),
    ]);
  if (error) return error.message;
  if (upError) return upError.message;

  const dim = (raw: unknown) =>
    (Array.isArray(raw) ? raw[0] : raw) as MatrixSize | null;
  const keep = (row: MatrixSize | null): row is MatrixSize => Boolean(row);

  return {
    sizes: (sizeRows ?? [])
      .map((row) => dim(row.size_chart_sizes))
      .filter(keep)
      .sort((a, b) => a.sort_order - b.sort_order),
    drops: (dropRows ?? [])
      .map((row) => dim(row.size_chart_drops))
      .filter(keep)
      .sort((a, b) => a.sort_order - b.sort_order),
    cells: (rows ?? [])
      .filter((row) => Number(row.qty_on_hand ?? 0) > 0)
      .map((row) => ({ size_id: row.size_id, drop_id: row.drop_id })),
    upcharges: (upRows ?? [])
      .map((row) => ({
        size_id: row.size_id,
        drop_id: row.drop_id,
        amount: Number(row.upcharge_amount ?? 0),
      }))
      .filter((row) => row.amount > 0),
  };
}
