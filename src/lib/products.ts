import { createClient } from "@/lib/supabase/server";

export async function loadProductMatrix(productId: string) {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      `
      id, standard_price, published, size_chart_id,
      lots ( lot_no, article, color_num, brands ( name ) ),
      models ( name, items ( name ), brands ( name ), size_chart_id )
    `,
    )
    .eq("id", productId)
    .single();

  const { data: pSizes } = await supabase
    .from("product_sizes")
    .select("size_id, size_chart_sizes ( id, code, sort_order )")
    .eq("product_id", productId);
  const { data: pDrops } = await supabase
    .from("product_drops")
    .select("drop_id, size_chart_drops ( id, code, sort_order )")
    .eq("product_id", productId);
  const { data: inventory } = await supabase
    .from("inventory")
    .select("size_id, drop_id, qty_on_hand, reorder_point")
    .eq("product_id", productId);
  const { data: upcharges } = await supabase
    .from("product_price_upcharges")
    .select("size_id, drop_id, upcharge_amount")
    .eq("product_id", productId);

  const sizes = (pSizes ?? [])
    .map((r) => {
      const s = r.size_chart_sizes as unknown as {
        id: string;
        code: string;
        sort_order: number;
      };
      return s;
    })
    .filter(Boolean);
  const drops = (pDrops ?? [])
    .map((r) => {
      const d = r.size_chart_drops as unknown as {
        id: string;
        code: string;
        sort_order: number;
      };
      return d;
    })
    .filter(Boolean);

  const upMap = new Map(
    (upcharges ?? []).map((u) => [
      `${u.size_id}:${u.drop_id}`,
      Number(u.upcharge_amount),
    ]),
  );
  const cells = (inventory ?? []).map((i) => ({
    size_id: i.size_id,
    drop_id: i.drop_id,
    qty: i.qty_on_hand,
    upcharge: upMap.get(`${i.size_id}:${i.drop_id}`) ?? 0,
    reorder_point: i.reorder_point,
  }));

  return { product, sizes, drops, cells };
}

export function parseCellFields(
  form: FormData,
  prefix: string,
): { size_id: string; drop_id: string; qty: number }[] {
  const out: { size_id: string; drop_id: string; qty: number }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith(prefix + ":")) continue;
    const parts = key.split(":");
    if (parts.length < 3) continue;
    out.push({
      size_id: parts[1],
      drop_id: parts[2],
      qty: Number(value) || 0,
    });
  }
  return out;
}
