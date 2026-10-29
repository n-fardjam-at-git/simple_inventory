import { createClient } from "@/lib/supabase/server";
import { isNoDropAxis, visibleDrops } from "@/lib/size-code";

function rel<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export type CuttingReportSize = { id: string; code: string; sort_order: number };
export type CuttingReportDrop = { id: string; code: string; sort_order: number };
export type CuttingReportCell = { size_id: string; drop_id: string; qty: number };

export type CuttingReportProduct = {
  product_id: string;
  model: string;
  item: string | null;
  instructions: string | null;
  bulk_order_qty: number | null;
  sizes: CuttingReportSize[];
  drops: CuttingReportDrop[];
  hide_drop: boolean;
  cells: CuttingReportCell[];
  total: number;
};

export type CuttingReportLot = {
  lot_id: string;
  lot_no: string;
  article: string | null;
  color_num: string | null;
  mill_article: string | null;
  products: CuttingReportProduct[];
};

export type CuttingOrderReport = {
  order_id: string;
  order_num: number;
  vendor: string | null;
  brand: string | null;
  date: string | null;
  reference: string | null;
  company: string;
  lots: CuttingReportLot[];
};

export async function loadCuttingOrderReport(
  orderId: string,
): Promise<CuttingOrderReport | null> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("cutting_orders")
    .select("id, order_num, arrival_date, date_submitted, reference, vendors ( name ), brands ( name )")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;

  const { data: company } = await supabase
    .from("company_profile")
    .select("trade_name")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();

  const { data: orderLotRows } = await supabase
    .from("cutting_order_lots")
    .select("lot_id, lots ( id, lot_no, article, color_num, mill_article )")
    .eq("cutting_order_id", orderId);

  const { data: lines } = await supabase
    .from("cutting_order_products")
    .select(
      "product_id, instructions, bulk_order_qty, products ( name, lots ( id ), models ( name, items ( name ) ) )",
    )
    .eq("cutting_order_id", orderId);

  const productIds = [...new Set((lines ?? []).map((l) => l.product_id))];
  const { data: pSizes } = productIds.length
    ? await supabase
        .from("product_sizes")
        .select("product_id, size_chart_sizes ( id, code, sort_order )")
        .in("product_id", productIds)
    : { data: [] as { product_id: string; size_chart_sizes: unknown }[] };
  const { data: pDrops } = productIds.length
    ? await supabase
        .from("product_drops")
        .select("product_id, size_chart_drops ( id, code, sort_order )")
        .in("product_id", productIds)
    : { data: [] as { product_id: string; size_chart_drops: unknown }[] };
  const { data: qtys } = productIds.length
    ? await supabase
        .from("cutting_quantities")
        .select("product_id, size_id, drop_id, qty_ordered")
        .eq("cutting_order_id", orderId)
        .in("product_id", productIds)
    : { data: [] as { product_id: string; size_id: string; drop_id: string; qty_ordered: number }[] };

  const lots: CuttingReportLot[] = [...(orderLotRows ?? [])]
    .map((r) => {
      const lot = rel<{
        id: string;
        lot_no: string;
        article: string | null;
        color_num: string | null;
        mill_article: string | null;
      }>(r.lots);
      return {
        lot_id: r.lot_id,
        lot_no: lot?.lot_no ?? "—",
        article: lot?.article ?? null,
        color_num: lot?.color_num ?? null,
        mill_article: lot?.mill_article ?? null,
        products: [] as CuttingReportProduct[],
      };
    })
    .sort((a, b) => a.lot_no.localeCompare(b.lot_no, "en", { sensitivity: "base" }));

  const byLot = new Map(lots.map((l) => [l.lot_id, l]));

  for (const line of lines ?? []) {
    const p = rel<{
      name: string | null;
      lots: { id: string } | { id: string }[] | null;
      models:
        | { name: string; items: { name: string } | { name: string }[] | null }
        | { name: string; items: { name: string } | { name: string }[] | null }[]
        | null;
    }>(line.products);
    const lot = rel<{ id: string }>(p?.lots ?? null);
    const model = rel<{ name: string; items: { name: string } | { name: string }[] | null }>(
      p?.models ?? null,
    );
    const item = rel<{ name: string }>(model?.items ?? null);
    const group = lot?.id ? byLot.get(lot.id) : undefined;
    if (!group) continue;

    const allSizes = (pSizes ?? [])
      .filter((r) => r.product_id === line.product_id)
      .map((r) => r.size_chart_sizes as unknown as CuttingReportSize)
      .filter(Boolean)
      .sort((a, b) => a.sort_order - b.sort_order);
    const allDrops = (pDrops ?? [])
      .filter((r) => r.product_id === line.product_id)
      .map((r) => r.size_chart_drops as unknown as CuttingReportDrop)
      .filter(Boolean)
      .sort((a, b) => a.sort_order - b.sort_order);
    const cells = (qtys ?? [])
      .filter((q) => q.product_id === line.product_id && Number(q.qty_ordered) > 0)
      .map((q) => ({
        size_id: q.size_id,
        drop_id: q.drop_id,
        qty: Number(q.qty_ordered),
      }));
    const dropIds = new Set(cells.map((c) => c.drop_id));
    const sizes = allSizes;
    const hide_drop = isNoDropAxis(allDrops);
    const drops = hide_drop
      ? allDrops.filter((d) => dropIds.has(d.id))
      : visibleDrops(allDrops).filter((d) => dropIds.has(d.id));
    const total = cells.reduce((s, c) => s + c.qty, 0);
    group.products.push({
      product_id: line.product_id,
      model: model?.name?.trim() || p?.name?.trim() || "Product",
      item: item?.name?.trim() || null,
      instructions: (line.instructions as string | null)?.trim() || null,
      bulk_order_qty: line.bulk_order_qty == null ? null : Number(line.bulk_order_qty),
      sizes,
      drops,
      hide_drop,
      cells,
      total,
    });
  }

  for (const lot of lots) {
    lot.products.sort((a, b) =>
      a.model.localeCompare(b.model, "en", { sensitivity: "base" }),
    );
  }

  const vendor = rel<{ name: string }>(order.vendors);
  const brand = rel<{ name: string }>(order.brands);
  const submitted = order.date_submitted ? String(order.date_submitted).slice(0, 10) : null;
  const arrival = order.arrival_date ? String(order.arrival_date).slice(0, 10) : null;

  return {
    order_id: order.id,
    order_num: order.order_num,
    vendor: vendor?.name ?? null,
    brand: brand?.name ?? null,
    date: submitted || arrival,
    reference: (order.reference as string | null)?.trim() || null,
    company: company?.trade_name?.trim() || "Gruppo Bravo",
    lots,
  };
}
