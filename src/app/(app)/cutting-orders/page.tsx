import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { productTitle } from "@/lib/product-type";
import { CuttingOrdersWorkspace } from "./CuttingOrdersWorkspace";
import type { CuttingOrderRow } from "./CuttingOrdersTable";
import type { CuttingOrderProductRow } from "./CuttingOrderProductsTable";
import type { CatalogProduct } from "./OrderDetailsPanel";

function rel<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export default async function CuttingOrdersPage() {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("cutting_orders")
    .select("id, order_num, vendor_id, arrival_date, reference, status, vendors ( name )")
    .order("order_num", { ascending: false });
  const { data: vendors } = await supabase.from("vendors").select("id, name, is_active").order("name");
  const { data: setItems } = await supabase
    .from("items")
    .select("id, name")
    .eq("in_set", true)
    .order("name");
  const { data: lines } = await supabase
    .from("cutting_order_products")
    .select(
      "cutting_order_id, product_id, status, products ( type, name, lots ( lot_no ), models ( name, items ( name ) ) )",
    );
  const { data: catalog } = await supabase
    .from("products")
    .select("id, type, name, is_active, lots ( lot_no ), models ( name, item_id )")
    .eq("type", 1)
    .eq("is_active", true);

  const rows: CuttingOrderRow[] = (orders ?? []).map((o) => {
    const vendorsRel = Array.isArray(o.vendors) ? o.vendors[0] : o.vendors;
    return {
      id: o.id,
      order_num: o.order_num,
      vendor_id: o.vendor_id,
      arrival_date: o.arrival_date,
      reference: o.reference,
      status: o.status,
      vendors: (vendorsRel as { name: string } | null) ?? null,
    };
  });

  const productLines: CuttingOrderProductRow[] = (lines ?? []).map((l) => {
    const p = rel<{
      type: number | null;
      name: string | null;
      lots: { lot_no: string } | { lot_no: string }[] | null;
      models:
        | { name: string; items: { name: string } | { name: string }[] | null }
        | { name: string; items: { name: string } | { name: string }[] | null }[]
        | null;
    }>(l.products);
    const lot = rel<{ lot_no: string }>(p?.lots);
    const model = rel<{ name: string; items: { name: string } | { name: string }[] | null }>(
      p?.models,
    );
    const item = rel<{ name: string }>(model?.items ?? null);
    return {
      cutting_order_id: l.cutting_order_id,
      product_id: l.product_id,
      status: l.status,
      products: p
        ? {
            type: p.type,
            name: p.name,
            lots: lot,
            models: model ? { name: model.name, items: item } : null,
          }
        : null,
      sizes: [] as CuttingOrderProductRow["sizes"],
      drops: [] as CuttingOrderProductRow["drops"],
      cells: [] as CuttingOrderProductRow["cells"],
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
      .select("cutting_order_id, product_id, size_id, drop_id, qty_ordered")
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
    }
  }

  const catalogProducts: CatalogProduct[] = (catalog ?? []).map((p) => {
    const lot = rel<{ lot_no: string }>(p.lots);
    const model = rel<{ name: string; item_id: string | null }>(p.models);
    return {
      id: p.id,
      item_id: model?.item_id ?? null,
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
      <PageTitle title="Cutting orders" />
      <CuttingOrdersWorkspace
        rows={rows}
        vendors={vendors ?? []}
        setItems={setItems ?? []}
        productLines={productLines}
        catalogProducts={catalogProducts}
      />
    </div>
  );
}
