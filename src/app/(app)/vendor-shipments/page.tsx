import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { productTitle } from "@/lib/product-type";
import { cuttingStatusOpen } from "@/lib/cutting-order";
import { VendorShipmentsWorkspace } from "./VendorShipmentsWorkspace";
import type { VendorShipmentRow } from "./VendorShipmentsTable";
import type { CatalogCutting, CatalogCuttingProduct, CuttingViewRow } from "./types";

function rel<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export default async function VendorShipmentsPage() {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { data: shipments } = await supabase
    .from("vendor_shipments")
    .select("id, shipment_num, vendor_id, received_date, air_way_no, posted, vendors ( name )")
    .order("shipment_num", { ascending: false });
  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name, is_active")
    .order("name");
  const { data: cuttings } = await supabase
    .from("cutting_orders")
    .select("id, order_num, vendor_id, status")
    .order("order_num", { ascending: false });
  const { data: orderProducts } = await supabase
    .from("cutting_order_products")
    .select(
      "cutting_order_id, product_id, status, products ( type, name, lots ( lot_no ), models ( name ) )",
    );
  const { data: viewLines, error: viewError } = await supabase
    .from("vendor_shipment_cutting_view")
    .select("id, shipment_id, cutting_order_id, product_id, order_num, product_label");
  if (viewError) throw new Error(viewError.message);

  const catalogCuttings: CatalogCutting[] = (cuttings ?? []).map((c) => ({
    id: c.id,
    order_num: c.order_num,
    vendor_id: c.vendor_id,
    status: cuttingStatusOpen(c.status),
  }));

  const catalogProducts: CatalogCuttingProduct[] = (orderProducts ?? []).map((p) => {
    const prod = rel<{
      type: number | null;
      name: string | null;
      lots: { lot_no: string } | { lot_no: string }[] | null;
      models: { name: string } | { name: string }[] | null;
    }>(p.products);
    const lot = rel<{ lot_no: string }>(prod?.lots ?? null);
    const model = rel<{ name: string }>(prod?.models ?? null);
    return {
      cutting_order_id: p.cutting_order_id,
      product_id: p.product_id,
      status: cuttingStatusOpen(p.status),
      label: productTitle({
        type: prod?.type,
        name: prod?.name,
        lots: lot,
        models: model,
      }),
    };
  });

  const lines: CuttingViewRow[] = (viewLines ?? []).map((l) => ({
    id: l.id,
    shipment_id: l.shipment_id,
    cutting_order_id: l.cutting_order_id,
    product_id: l.product_id,
    order_num: l.order_num,
    product_label: l.product_label,
    sizes: [],
    drops: [],
    cells: [],
  }));

  const productIds = [...new Set(lines.map((l) => l.product_id))];
  if (productIds.length) {
    const { data: pSizes } = await supabase
      .from("product_sizes")
      .select("product_id, size_chart_sizes ( id, code, sort_order )")
      .in("product_id", productIds);
    const { data: pDrops } = await supabase
      .from("product_drops")
      .select("product_id, size_chart_drops ( id, code, sort_order )")
      .in("product_id", productIds);
    const { data: cells } = await supabase
      .from("vendor_shipment_cells")
      .select("shipment_product_id, size_id, drop_id, qty")
      .in(
        "shipment_product_id",
        lines.map((l) => l.id),
      );

    for (const line of lines) {
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
      line.cells = (cells ?? [])
        .filter((c) => c.shipment_product_id === line.id)
        .map((c) => ({
          size_id: c.size_id,
          drop_id: c.drop_id,
          qty: c.qty,
        }));
    }
  }

  const withLines = new Set(lines.map((l) => l.shipment_id));
  const rows: VendorShipmentRow[] = (shipments ?? []).map((s) => ({
    id: s.id,
    shipment_num: s.shipment_num,
    vendor_id: s.vendor_id,
    received_date: s.received_date,
    air_way_no: s.air_way_no,
    posted: s.posted,
    has_lines: withLines.has(s.id),
    vendors: rel<{ name: string }>(s.vendors),
  }));

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <VendorShipmentsWorkspace
        rows={rows}
        vendors={vendors ?? []}
        today={today}
        lines={lines}
        catalogCuttings={catalogCuttings}
        catalogProducts={catalogProducts}
      />
    </div>
  );
}
