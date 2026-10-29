import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { cuttingStatusOpen } from "@/lib/cutting-order";
import { VendorAdvicesWorkspace } from "./VendorAdvicesWorkspace";
import type { AdviceRow } from "./VendorAdvicesTable";
import type { AdviceCutting, AdviceCuttingProduct, AdviceLine } from "./types";

function rel<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export default async function VendorAdvicesPage() {
  const profile = await requireRoles(["admin", "warehouse", "vendor"]);
  const viewer = profile.role === "vendor" ? "vendor" : "staff";
  const supabase = await createClient();

  const { data: advices } = await supabase
    .from("vendor_advices")
    .select("id, advice_num, vendor_id, ship_date, air_way_no, notes, status, vendors ( name )")
    .order("advice_num", { ascending: false });

  const { data: rawLines } = await supabase
    .from("vendor_advice_products")
    .select(
      "id, advice_id, cutting_order_id, product_id, cutting_orders ( order_num ), products ( name )",
    );

  const lines: AdviceLine[] = (rawLines ?? []).map((l) => {
    const order = rel<{ order_num: number }>(l.cutting_orders);
    const product = rel<{ name: string | null }>(l.products);
    return {
      id: l.id,
      advice_id: l.advice_id,
      cutting_order_id: l.cutting_order_id,
      product_id: l.product_id,
      order_num: order?.order_num ?? 0,
      product_label: product?.name?.trim() || "Product",
      sizes: [],
      drops: [],
      cells: [],
    };
  });

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
      .from("vendor_advice_cells")
      .select("advice_product_id, size_id, drop_id, qty")
      .in(
        "advice_product_id",
        lines.map((l) => l.id),
      );
    for (const line of lines) {
      line.sizes = (pSizes ?? [])
        .filter((r) => r.product_id === line.product_id)
        .map((r) => r.size_chart_sizes as unknown as AdviceLine["sizes"][number])
        .filter(Boolean);
      line.drops = (pDrops ?? [])
        .filter((r) => r.product_id === line.product_id)
        .map((r) => r.size_chart_drops as unknown as AdviceLine["drops"][number])
        .filter(Boolean);
      line.cells = (cells ?? [])
        .filter((c) => c.advice_product_id === line.id)
        .map((c) => ({ size_id: c.size_id, drop_id: c.drop_id, qty: c.qty }));
    }
  }

  let cuttings: AdviceCutting[] = [];
  let products: AdviceCuttingProduct[] = [];
  if (viewer === "vendor") {
    const { data: orders } = await supabase
      .from("cutting_orders")
      .select("id, order_num, vendor_id, status")
      .order("order_num", { ascending: false });
    const { data: orderProducts } = await supabase
      .from("cutting_order_products")
      .select("cutting_order_id, product_id, products ( name )");
    cuttings = (orders ?? []).map((c) => ({
      id: c.id,
      order_num: c.order_num,
      vendor_id: c.vendor_id,
      status: cuttingStatusOpen(c.status),
    }));
    products = (orderProducts ?? []).map((p) => ({
      cutting_order_id: p.cutting_order_id,
      product_id: p.product_id,
      label: rel<{ name: string | null }>(p.products)?.name?.trim() || "Product",
    }));
  }

  const rows: AdviceRow[] = (advices ?? []).map((a) => ({
    id: a.id,
    advice_num: a.advice_num,
    vendor_id: a.vendor_id,
    vendor_name: rel<{ name: string }>(a.vendors)?.name ?? null,
    ship_date: a.ship_date,
    air_way_no: a.air_way_no,
    notes: a.notes,
    status: a.status,
  }));

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <VendorAdvicesWorkspace
        rows={rows}
        lines={lines}
        cuttings={cuttings}
        products={products}
        viewer={viewer}
        today={today}
      />
    </div>
  );
}
