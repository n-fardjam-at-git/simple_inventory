import { createClient } from "@/lib/supabase/server";

export async function loadProductMatrix(productId: string) {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      `
      id, type, name, standard_price, published, size_chart_id,
      lots ( lot_no, article, color_num, brands ( name ) ),
      models ( name, items ( name ), size_chart_id )
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

export async function loadInventoryBoards() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, type, name, is_active, availability, collection_id, collections ( name ), lots ( lot_no, article, color_num, brand_id, color_id, pattern_id, content_id, brands ( name ), colors ( name ), patterns ( name ), contents ( name ) ), models ( id, name, item_id, items ( name ) )",
    )
    .eq("type", 1);

  function rel<T>(raw: unknown): T | null {
    return (Array.isArray(raw) ? raw[0] : raw) as T | null;
  }
  function one(v: { name: string } | { name: string }[] | null | undefined) {
    return (Array.isArray(v) ? v[0] : v)?.name ?? null;
  }
  function sortKey(product: (typeof products)[number]) {
    const lot = rel<{
      article: string | null;
      color_num: string | null;
      brands: { name: string } | { name: string }[] | null;
    }>(product.lots);
    const model = rel<{ name: string }>(product.models);
    return {
      brand: one(lot?.brands) ?? "",
      article: lot?.article ?? "",
      colorNum: lot?.color_num ?? "",
      model: model?.name ?? "",
    };
  }
  const ordered = [...(products ?? [])].sort((a, b) => {
    const A = sortKey(a);
    const B = sortKey(b);
    return (
      A.brand.localeCompare(B.brand, "en", { sensitivity: "base" }) ||
      A.article.localeCompare(B.article, "en", { sensitivity: "base" }) ||
      A.colorNum.localeCompare(B.colorNum, "en", { numeric: true, sensitivity: "base" }) ||
      A.model.localeCompare(B.model, "en", { sensitivity: "base" })
    );
  });

  const ids = ordered.map((p) => p.id);
  if (!ids.length) return [];

  const { data: pSizes } = await supabase
    .from("product_sizes")
    .select("product_id, size_chart_sizes ( id, code, sort_order )")
    .in("product_id", ids);
  const { data: pDrops } = await supabase
    .from("product_drops")
    .select("product_id, size_chart_drops ( id, code, sort_order )")
    .in("product_id", ids);
  const { data: inventory } = await supabase
    .from("inventory")
    .select("product_id, size_id, drop_id, qty_on_hand")
    .in("product_id", ids);
  const { data: upcharges } = await supabase
    .from("product_price_upcharges")
    .select("product_id, size_id, drop_id, upcharge_amount")
    .in("product_id", ids);

  return ordered.map((product) => {
    const sizes = (pSizes ?? [])
      .filter((r) => r.product_id === product.id)
      .map((r) => r.size_chart_sizes as unknown as { id: string; code: string; sort_order: number })
      .filter(Boolean);
    const drops = (pDrops ?? [])
      .filter((r) => r.product_id === product.id)
      .map((r) => r.size_chart_drops as unknown as { id: string; code: string; sort_order: number })
      .filter(Boolean);
    const upMap = new Map(
      (upcharges ?? [])
        .filter((u) => u.product_id === product.id)
        .map((u) => [`${u.size_id}:${u.drop_id}`, Number(u.upcharge_amount)]),
    );
    const cells = (inventory ?? [])
      .filter((i) => i.product_id === product.id)
      .map((i) => ({
        size_id: i.size_id,
        drop_id: i.drop_id,
        qty: i.qty_on_hand,
        upcharge: upMap.get(`${i.size_id}:${i.drop_id}`) ?? 0,
      }));
    const lot = rel<{
      lot_no: string;
      brand_id: string | null;
      color_id: string | null;
      pattern_id: string | null;
      content_id: string | null;
      brands: { name: string } | { name: string }[] | null;
      colors: { name: string } | { name: string }[] | null;
      patterns: { name: string } | { name: string }[] | null;
      contents: { name: string } | { name: string }[] | null;
    }>(product.lots);
    const model = rel<{
      id: string;
      name: string;
      item_id: string | null;
      items: { name: string } | { name: string }[] | null;
    }>(product.models);
    const itemName = one(model?.items ?? null);
    const collectionRaw = product.collections as unknown;
    const collection = (Array.isArray(collectionRaw) ? collectionRaw[0] : collectionRaw) as {
      name: string;
    } | null;
    const fabric = [one(lot?.colors), one(lot?.patterns), one(lot?.contents)]
      .filter(Boolean)
      .join(", ");
    return {
      productId: product.id,
      title: product.name ?? `${lot?.lot_no}>${model?.name}`,
      subtitle: [one(lot?.brands), itemName, collection?.name ?? null]
        .filter(Boolean)
        .join(" • "),
      fabric,
      isActive: Boolean(product.is_active),
      availability: (product.availability as string | null) ?? null,
      collectionId: (product.collection_id as string | null) ?? null,
      brandId: lot?.brand_id ?? null,
      lotNo: lot?.lot_no ?? null,
      itemId: model?.item_id ?? null,
      modelId: model?.id ?? null,
      colorId: lot?.color_id ?? null,
      patternId: lot?.pattern_id ?? null,
      contentId: lot?.content_id ?? null,
      sizes,
      drops,
      cells,
    };
  });
}

export async function loadChargeProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, type, name, standard_price, is_active")
    .in("type", [2, 3])
    .order("type")
    .order("name");
  return (data ?? []).map((p) => ({
    id: p.id,
    type: p.type as number,
    name: p.name as string | null,
    standard_price: Number(p.standard_price),
    is_active: p.is_active as boolean,
  }));
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
