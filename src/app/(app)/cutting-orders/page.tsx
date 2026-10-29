import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { productTitle } from "@/lib/product-type";
import { cuttingStatusOpen } from "@/lib/cutting-order";
import { CuttingOrdersWorkspace } from "./CuttingOrdersWorkspace";
import type { CuttingOrderRow } from "./CuttingOrdersTable";
import type { CuttingOrderProductRow } from "./CuttingOrderProductsTable";
import { asSeasonRows } from "@/lib/season";
import type { CatalogLot, CatalogProduct } from "./OrderDetailsPanel";
import type { CuttingOrderLotRow } from "./CuttingOrderLotsTable";
import type { CatalogModel, ChartDim } from "./NewOrderProductPopup";

function rel<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export default async function CuttingOrdersPage() {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("cutting_orders")
    .select("id, order_num, vendor_id, brand_id, arrival_date, date_submitted, reference, status, vendors ( name ), brands ( name )")
    .order("order_num", { ascending: false });
  const { data: vendors } = await supabase.from("vendors").select("id, name, is_active").order("name");
  const { data: brands } = await supabase.from("brands").select("id, name, is_active").order("name");
  const { data: setItems } = await supabase
    .from("items")
    .select("id, name")
    .eq("in_set", true)
    .order("name")
    .limit(14);
  const { data: lines } = await supabase
    .from("cutting_order_products")
    .select(
      "cutting_order_id, product_id, status, instructions, bulk_order_qty, products ( type, name, size_chart_id, lots ( id, lot_no, brand_id, brands ( name ) ), models ( name, item_id, items ( name ) ) )",
    );
  const { data: orderLotRows } = await supabase
    .from("cutting_order_lots")
    .select("cutting_order_id, lot_id, lots ( lot_no, article )");
  const { data: catalogLots } = await supabase
    .from("lots")
    .select("id, lot_no, article, color_num, brand_id, pattern_id, content_id, is_active")
    .order("lot_no");
  const { data: colors } = await supabase.from("colors").select("id, name, is_active").order("name");
  const { data: patterns } = await supabase.from("patterns").select("id, name, is_active").order("name");
  const { data: contents } = await supabase.from("contents").select("id, name, is_active").order("name");
  const { data: models } = await supabase
    .from("models")
    .select("id, name, item_id, size_chart_id, is_active, items ( name )")
    .eq("is_active", true)
    .order("name");
  const { data: sizes } = await supabase
    .from("size_chart_sizes")
    .select("id, code, chart_id, sort_order")
    .order("sort_order");
  const { data: drops } = await supabase
    .from("size_chart_drops")
    .select("id, code, chart_id, sort_order")
    .order("sort_order");
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, year, start_season, is_combo, season");
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const { data: catalog } = await supabase
    .from("products")
    .select("id, type, name, is_active, lots ( id, lot_no, brand_id ), models ( name, item_id )")
    .eq("type", 1)
    .eq("is_active", true);

  const ordersWithLots = new Set((orderLotRows ?? []).map((l) => l.cutting_order_id));
  const orderIds = (orders ?? []).map((o) => o.id);
  const orderQty = new Map<string, { ordered: number; received: number }>();
  if (orderIds.length) {
    const { data: qtyRows } = await supabase
      .from("cutting_quantities")
      .select("cutting_order_id, qty_ordered, qty_received")
      .in("cutting_order_id", orderIds);
    for (const q of qtyRows ?? []) {
      const t = orderQty.get(q.cutting_order_id) ?? { ordered: 0, received: 0 };
      t.ordered += Number(q.qty_ordered ?? 0);
      t.received += Number(q.qty_received ?? 0);
      orderQty.set(q.cutting_order_id, t);
    }
  }
  const rows: CuttingOrderRow[] = (orders ?? []).map((o) => {
    const vendorsRel = Array.isArray(o.vendors) ? o.vendors[0] : o.vendors;
    const brandsRel = Array.isArray(o.brands) ? o.brands[0] : o.brands;
    const qty = orderQty.get(o.id) ?? { ordered: 0, received: 0 };
    return {
      id: o.id,
      order_num: o.order_num,
      vendor_id: o.vendor_id,
      brand_id: o.brand_id,
      arrival_date: o.arrival_date,
      date_submitted: o.date_submitted ?? null,
      reference: o.reference,
      status: cuttingStatusOpen(o.status),
      has_lots: ordersWithLots.has(o.id),
      qty_ordered: qty.ordered,
      qty_received: qty.received,
      vendors: (vendorsRel as { name: string } | null) ?? null,
      brands: (brandsRel as { name: string } | null) ?? null,
    };
  });

  const productLines: CuttingOrderProductRow[] = (lines ?? []).map((l) => {
    const p = rel<{
      type: number | null;
      name: string | null;
      size_chart_id: string | null;
      lots:
        | {
            id: string;
            lot_no: string;
            brand_id: string | null;
            brands: { name: string } | { name: string }[] | null;
          }
        | {
            id: string;
            lot_no: string;
            brand_id: string | null;
            brands: { name: string } | { name: string }[] | null;
          }[]
        | null;
      models:
        | { name: string; item_id: string | null; items: { name: string } | { name: string }[] | null }
        | { name: string; item_id: string | null; items: { name: string } | { name: string }[] | null }[]
        | null;
    }>(l.products);
    const lot = rel<{
      id: string;
      lot_no: string;
      brand_id: string | null;
      brands: { name: string } | { name: string }[] | null;
    }>(p?.lots);
    const brand = rel<{ name: string }>(lot?.brands ?? null);
    const model = rel<{
      name: string;
      item_id: string | null;
      items: { name: string } | { name: string }[] | null;
    }>(p?.models);
    const item = rel<{ name: string }>(model?.items ?? null);
    return {
      cutting_order_id: l.cutting_order_id,
      product_id: l.product_id,
      status: cuttingStatusOpen(l.status),
      instructions: (l.instructions as string | null) ?? null,
      bulk_order_qty:
        l.bulk_order_qty == null ? null : Number(l.bulk_order_qty),
      products: p
        ? {
            type: p.type,
            name: p.name,
            lots: lot ? { ...lot, brands: brand } : null,
            models: model ? { name: model.name, items: item } : null,
          }
        : null,
      sizes: [] as CuttingOrderProductRow["sizes"],
      drops: [] as CuttingOrderProductRow["drops"],
      cells: [] as CuttingOrderProductRow["cells"],
      qty_received: 0,
      brand_id: lot?.brand_id ?? null,
      item_id: model?.item_id ?? null,
      size_chart_id: p?.size_chart_id ?? null,
    };
  });

  const productIds = [...new Set(productLines.map((l) => l.product_id))];
  if (productIds.length) {
    const { data: pSizes } = await supabase
      .from("product_sizes")
      .select("product_id, size_chart_sizes ( id, code, sort_order )")
      .in("product_id", productIds);
    const { data: pDrops } = await supabase
      .from("product_drops")
      .select("product_id, size_chart_drops ( id, code, sort_order )")
      .in("product_id", productIds);
    const { data: qtys } = await supabase
      .from("cutting_quantities")
      .select("cutting_order_id, product_id, size_id, drop_id, qty_ordered, qty_received")
      .in("product_id", productIds);

    for (const line of productLines) {
      line.sizes = (pSizes ?? [])
        .filter((r) => r.product_id === line.product_id)
        .map(
          (r) =>
            r.size_chart_sizes as unknown as {
              id: string;
              code: string;
              sort_order: number;
            },
        )
        .filter(Boolean);
      line.drops = (pDrops ?? [])
        .filter((r) => r.product_id === line.product_id)
        .map(
          (r) =>
            r.size_chart_drops as unknown as {
              id: string;
              code: string;
              sort_order: number;
            },
        )
        .filter(Boolean);
      line.cells = (qtys ?? [])
        .filter(
          (q) =>
            q.cutting_order_id === line.cutting_order_id && q.product_id === line.product_id,
        )
        .map((q) => ({
          size_id: q.size_id,
          drop_id: q.drop_id,
          qty: q.qty_ordered,
        }));
      line.qty_received = (qtys ?? [])
        .filter(
          (q) =>
            q.cutting_order_id === line.cutting_order_id && q.product_id === line.product_id,
        )
        .reduce((sum, q) => sum + Number(q.qty_received ?? 0), 0);
    }
  }

  const orderLots: CuttingOrderLotRow[] = [...(orderLotRows ?? [])]
    .sort((a, b) => {
      const an = rel<{ lot_no: string }>(a.lots)?.lot_no ?? "";
      const bn = rel<{ lot_no: string }>(b.lots)?.lot_no ?? "";
      return an.localeCompare(bn, "en", { sensitivity: "base" });
    })
    .map((r) => {
      const lot = rel<{ lot_no: string; article: string | null }>(r.lots);
      return {
        cutting_order_id: r.cutting_order_id,
        lot_id: r.lot_id,
        lot_no: lot?.lot_no ?? "—",
        article: lot?.article ?? null,
        has_products: false,
      };
    });
  const productsByOrderLot = new Set(
    productLines.map((l) => `${l.cutting_order_id}:${l.products?.lots?.id ?? ""}`),
  );
  for (const lot of orderLots) {
    lot.has_products = productsByOrderLot.has(`${lot.cutting_order_id}:${lot.lot_id}`);
  }

  const catalogProducts: CatalogProduct[] = (catalog ?? []).map((p) => {
    const lot = rel<{ id: string; lot_no: string; brand_id: string | null }>(p.lots);
    const model = rel<{ name: string; item_id: string | null }>(p.models);
    return {
      id: p.id,
      item_id: model?.item_id ?? null,
      brand_id: lot?.brand_id ?? null,
      lot_id: lot?.id ?? null,
      label: productTitle({
        type: p.type,
        name: p.name,
        lots: lot,
        models: model,
      }),
    };
  });

  return (
    <div>
      <CuttingOrdersWorkspace
        rows={rows}
        vendors={vendors ?? []}
        brands={brands ?? []}
        setItems={setItems ?? []}
        productLines={productLines}
        orderLots={orderLots}
        catalogProducts={catalogProducts}
        catalogLots={(catalogLots ?? []).map((l) => ({
          id: l.id,
          lot_no: l.lot_no,
          brand_id: l.brand_id,
          is_active: l.is_active,
          article: l.article,
          color_num: l.color_num,
          pattern_id: l.pattern_id,
          content_id: l.content_id,
        }))}
        colors={colors ?? []}
        patterns={patterns ?? []}
        contents={contents ?? []}
        models={(models ?? []).map((m) => {
          const item = rel<{ name: string }>(m.items);
          return {
            id: m.id,
            name: m.name,
            item_id: m.item_id,
            size_chart_id: m.size_chart_id,
            item_name: item?.name ?? null,
          } satisfies CatalogModel;
        })}
        sizes={(sizes ?? []) as ChartDim[]}
        drops={(drops ?? []) as ChartDim[]}
        seasons={asSeasonRows(seasons ?? [])}
        collections={collections ?? []}
      />
    </div>
  );
}
