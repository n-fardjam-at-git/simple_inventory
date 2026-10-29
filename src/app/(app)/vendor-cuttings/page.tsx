import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { cuttingStatusOpen } from "@/lib/cutting-order";
import { VendorCuttingsWorkspace } from "./VendorCuttingsWorkspace";
import type { VendorCuttingLine, VendorCuttingRow } from "./types";

function rel<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export default async function VendorCuttingsPage() {
  await requireRoles(["vendor"]);
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("cutting_orders")
    .select("id, order_num, date_submitted, status, brands ( name )")
    .not("date_submitted", "is", null)
    .order("order_num", { ascending: false });

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: rawLines } = orderIds.length
    ? await supabase
        .from("cutting_order_products")
        .select("cutting_order_id, product_id, bulk_order_qty, products ( name )")
        .in("cutting_order_id", orderIds)
    : { data: [] as {
        cutting_order_id: string;
        product_id: string;
        bulk_order_qty: number | null;
        products: unknown;
      }[] };

  const lines: VendorCuttingLine[] = (rawLines ?? []).map((l) => {
    const product = rel<{ name: string | null }>(l.products);
    return {
      id: `${l.cutting_order_id}:${l.product_id}`,
      cutting_order_id: l.cutting_order_id,
      product_id: l.product_id,
      product_label: product?.name?.trim() || "Product",
      bulk_order_qty: l.bulk_order_qty,
      sizes: [],
      drops: [],
      cells: [],
    };
  });

  const productIds = [...new Set(lines.map((l) => l.product_id))];
  if (productIds.length && orderIds.length) {
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
      .in("cutting_order_id", orderIds);
    for (const line of lines) {
      line.sizes = (pSizes ?? [])
        .filter((r) => r.product_id === line.product_id)
        .map((r) => r.size_chart_sizes as unknown as VendorCuttingLine["sizes"][number])
        .filter(Boolean);
      line.drops = (pDrops ?? [])
        .filter((r) => r.product_id === line.product_id)
        .map((r) => r.size_chart_drops as unknown as VendorCuttingLine["drops"][number])
        .filter(Boolean);
      line.cells = (qtys ?? [])
        .filter(
          (q) =>
            q.cutting_order_id === line.cutting_order_id &&
            q.product_id === line.product_id &&
            Number(q.qty_ordered) > 0,
        )
        .map((q) => ({
          size_id: q.size_id,
          drop_id: q.drop_id,
          qty: Number(q.qty_ordered),
        }));
    }
  }

  const rows: VendorCuttingRow[] = (orders ?? []).map((o) => ({
    id: o.id,
    order_num: o.order_num,
    date_submitted: String(o.date_submitted).slice(0, 10),
    open: cuttingStatusOpen(o.status),
    brand: rel<{ name: string }>(o.brands)?.name ?? null,
  }));

  return (
    <div>
      <VendorCuttingsWorkspace rows={rows} lines={lines} />
    </div>
  );
}
