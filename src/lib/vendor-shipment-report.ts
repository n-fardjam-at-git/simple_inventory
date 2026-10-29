import { createClient } from "@/lib/supabase/server";
import { isNoDropAxis, visibleDrops } from "@/lib/size-code";
import type {
  CuttingReportCell,
  CuttingReportDrop,
  CuttingReportProduct,
  CuttingReportSize,
} from "@/lib/cutting-order-report";

function rel<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export type VendorShipmentReportLine = CuttingReportProduct & {
  line_id: string;
  name: string;
  order_num: number;
};

export type VendorShipmentItemTotal = {
  item: string;
  qty: number;
};

export type VendorShipmentReport = {
  shipment_id: string;
  shipment_num: number;
  vendor: string | null;
  received_date: string | null;
  air_way_no: string | null;
  posted: boolean;
  company: string;
  lines: VendorShipmentReportLine[];
  item_totals: VendorShipmentItemTotal[];
};

export async function loadVendorShipmentReport(
  shipmentId: string,
): Promise<VendorShipmentReport | null> {
  const supabase = await createClient();
  const { data: shipment } = await supabase
    .from("vendor_shipments")
    .select("id, shipment_num, received_date, air_way_no, posted, vendors ( name )")
    .eq("id", shipmentId)
    .maybeSingle();
  if (!shipment) return null;

  const { data: company } = await supabase
    .from("company_profile")
    .select("trade_name")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();

  const { data: rows } = await supabase
    .from("vendor_shipment_products")
    .select(
      "id, cutting_order_id, product_id, cutting_orders ( order_num ), products ( name, models ( name, items ( name ) ) )",
    )
    .eq("shipment_id", shipmentId);

  const productIds = [...new Set((rows ?? []).map((l) => l.product_id))];
  const lineIds = (rows ?? []).map((l) => l.id);

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
  const { data: cells } = lineIds.length
    ? await supabase
        .from("vendor_shipment_cells")
        .select("shipment_product_id, size_id, drop_id, qty")
        .in("shipment_product_id", lineIds)
    : { data: [] as { shipment_product_id: string; size_id: string; drop_id: string; qty: number }[] };

  const lines: VendorShipmentReportLine[] = [];
  for (const line of rows ?? []) {
    const order = rel<{ order_num: number }>(line.cutting_orders);
    const p = rel<{
      name: string | null;
      models:
        | { name: string; items: { name: string } | { name: string }[] | null }
        | { name: string; items: { name: string } | { name: string }[] | null }[]
        | null;
    }>(line.products);
    const model = rel<{ name: string; items: { name: string } | { name: string }[] | null }>(
      p?.models ?? null,
    );
    const item = rel<{ name: string }>(model?.items ?? null);
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
    const lineCells = (cells ?? [])
      .filter((c) => c.shipment_product_id === line.id && Number(c.qty) > 0)
      .map((c) => ({
        size_id: c.size_id,
        drop_id: c.drop_id,
        qty: Number(c.qty),
      })) satisfies CuttingReportCell[];
    const dropIds = new Set(lineCells.map((c) => c.drop_id));
    const hide_drop = isNoDropAxis(allDrops);
    const drops = hide_drop
      ? allDrops.filter((d) => dropIds.has(d.id))
      : visibleDrops(allDrops).filter((d) => dropIds.has(d.id));
    const total = lineCells.reduce((s, c) => s + c.qty, 0);
    const name = p?.name?.trim() || model?.name?.trim() || "Product";
    lines.push({
      line_id: line.id,
      product_id: line.product_id,
      name,
      order_num: order?.order_num ?? 0,
      model: name,
      item: item?.name?.trim() || null,
      instructions: null,
      bulk_order_qty: null,
      sizes: allSizes,
      drops,
      hide_drop,
      cells: lineCells,
      total,
    });
  }

  lines.sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    if (byName) return byName;
    return a.order_num - b.order_num;
  });

  const byItem = new Map<string, number>();
  for (const line of lines) {
    const item = line.item?.trim() || "—";
    byItem.set(item, (byItem.get(item) ?? 0) + line.total);
  }
  const item_totals = [...byItem.entries()]
    .map(([item, qty]) => ({ item, qty }))
    .sort((a, b) => a.item.localeCompare(b.item, "en", { sensitivity: "base" }));

  const vendor = rel<{ name: string }>(shipment.vendors);
  return {
    shipment_id: shipment.id,
    shipment_num: shipment.shipment_num,
    vendor: vendor?.name ?? null,
    received_date: shipment.received_date ? String(shipment.received_date).slice(0, 10) : null,
    air_way_no: (shipment.air_way_no as string | null)?.trim() || null,
    posted: Boolean(shipment.posted),
    company: company?.trade_name?.trim() || "Gruppo Bravo",
    lines,
    item_totals,
  };
}
