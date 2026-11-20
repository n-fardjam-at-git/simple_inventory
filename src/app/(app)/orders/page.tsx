import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { asSeasonRows } from "@/lib/season";
import type { OrderProductLine } from "../customer-orders/OrderProductsPanel";
import { OrdersWorkspace } from "./OrdersWorkspace";
import type { CustomerProcessOrder } from "./types";

function one<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

function addressLines(order: Record<string, unknown>, prefix: "ship" | "bill") {
  const text = (key: string) => {
    const value = order[`${prefix}_${key}`];
    return typeof value === "string" ? value.trim() : "";
  };
  const cityLine = [text("city"), [text("region"), text("postal_code")].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [text("address_line1"), text("address_line2"), cityLine, text("country")].filter(Boolean);
}

export default async function OrdersPage() {
  await requireRoles(["customer"]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: login } = await supabase
    .from("profiles")
    .select("customer_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  let customerId = (login?.customer_id as string | null) ?? null;
  if (!customerId && user) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    customerId = customer?.id ?? null;
  }
  if (!customerId) {
    return <p className="text-sm text-stone-600">Your login is not linked to a customer.</p>;
  }

  const [{ data: orders }, { data: seasonRows }] = await Promise.all([
    supabase
      .from("customer_orders")
      .select(
        "id, order_no, po_no, created_at, status, start_date, cancel_date, future_season, terms, shipping_method, ship_address_line1, ship_address_line2, ship_city, ship_region, ship_postal_code, ship_country, bill_address_line1, bill_address_line2, bill_city, bill_region, bill_postal_code, bill_country, customers ( company_name )",
      )
      .eq("customer_id", customerId)
      .order("order_no", { ascending: false }),
    supabase.from("seasons").select("id, year, start_season, is_combo, season"),
  ]);
  const ids = (orders ?? []).map((order) => order.id);
  const { data: lineRows } = ids.length
    ? await supabase
        .from("customer_order_products")
        .select(
          "customer_order_id, product_id, price, qty, status, products ( name, type, size_chart_id, models ( name, item_id, items ( name ) ) )",
        )
        .in("customer_order_id", ids)
    : { data: [] };
  const { data: cellRows } = ids.length
    ? await supabase
        .from("customer_order_cells")
        .select("customer_order_id, product_id, size_id, drop_id, qty, qty_shipped, price")
        .in("customer_order_id", ids)
    : { data: [] };
  const productIds = [...new Set((lineRows ?? []).map((line) => line.product_id))];
  const [{ data: sizeRows }, { data: dropRows }] = await Promise.all([
    productIds.length
      ? supabase
          .from("product_sizes")
          .select("product_id, size_chart_sizes ( id, code, sort_order )")
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string; size_chart_sizes: unknown }[] }),
    productIds.length
      ? supabase
          .from("product_drops")
          .select("product_id, size_chart_drops ( id, code, sort_order )")
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string; size_chart_drops: unknown }[] }),
  ]);
  const merchandiseLine = new Set(
    (lineRows ?? [])
      .filter((line) => (one<{ type: number | null }>(line.products)?.type ?? 1) === 1)
      .map((line) => `${line.customer_order_id}:${line.product_id}`),
  );
  const leftByOrder = new Map<string, number>();
  for (const cell of cellRows ?? []) {
    const key = `${cell.customer_order_id}:${cell.product_id}`;
    if (!merchandiseLine.has(key)) continue;
    const left = Number(cell.qty ?? 0) - Number(cell.qty_shipped ?? 0);
    leftByOrder.set(cell.customer_order_id, (leftByOrder.get(cell.customer_order_id) ?? 0) + left);
  }

  const rows: CustomerProcessOrder[] = (orders ?? []).map((order) => {
    const customer = one<{ company_name: string | null }>(order.customers);
    return {
      id: order.id,
      order_no: order.order_no,
      created_date: order.created_at ? String(order.created_at).slice(0, 10) : null,
      customer: customer?.company_name?.trim() || "Order",
      start_date: order.start_date,
      cancel_date: order.cancel_date ?? null,
      status: order.status,
      left_to_ship:
        order.status === "complete" || order.status === "canceled"
          ? 0
          : Math.max(0, leftByOrder.get(order.id) ?? 0),
      future_season: order.future_season ?? null,
      terms: order.terms ?? null,
      shipping_method: order.shipping_method?.trim() || null,
      ship_to: addressLines(order as Record<string, unknown>, "ship"),
      bill_to: addressLines(order as Record<string, unknown>, "bill"),
      po_no: order.po_no ?? null,
    };
  });

  const sizesByProduct = new Map<string, MatrixSize[]>();
  for (const row of sizeRows ?? []) {
    const size = one<MatrixSize>(row.size_chart_sizes);
    if (!size) continue;
    const list = sizesByProduct.get(row.product_id) ?? [];
    list.push(size);
    sizesByProduct.set(row.product_id, list);
  }
  const dropsByProduct = new Map<string, MatrixDrop[]>();
  for (const row of dropRows ?? []) {
    const drop = one<MatrixDrop>(row.size_chart_drops);
    if (!drop) continue;
    const list = dropsByProduct.get(row.product_id) ?? [];
    list.push(drop);
    dropsByProduct.set(row.product_id, list);
  }
  const cellsByLine = new Map<string, Cell[]>();
  const shippedByLine = new Map<string, number>();
  const shippedExtraByLine = new Map<string, number>();
  for (const cell of cellRows ?? []) {
    const key = `${cell.customer_order_id}:${cell.product_id}`;
    const list = cellsByLine.get(key) ?? [];
    list.push({
      size_id: cell.size_id,
      drop_id: cell.drop_id,
      qty: Number(cell.qty ?? 0),
      upcharge: cell.price == null ? 0 : Number(cell.price),
    });
    cellsByLine.set(key, list);
    shippedByLine.set(key, (shippedByLine.get(key) ?? 0) + Number(cell.qty_shipped ?? 0));
    shippedExtraByLine.set(
      key,
      (shippedExtraByLine.get(key) ?? 0) +
        Number(cell.qty_shipped ?? 0) * (cell.price == null ? 0 : Number(cell.price)),
    );
  }
  const lines: OrderProductLine[] = (lineRows ?? []).map((line) => {
    const product = one<{
      name: string | null;
      type: number | null;
      size_chart_id: string | null;
      models:
        | {
            name: string | null;
            item_id: string | null;
            items: { name: string | null } | { name: string | null }[] | null;
          }
        | null;
    }>(line.products);
    const model = one<{
      name: string | null;
      item_id: string | null;
      items: { name: string | null } | { name: string | null }[] | null;
    }>(product?.models ?? null);
    const item = one<{ name: string | null }>(model?.items ?? null);
    const type = product?.type ?? 1;
    const key = `${line.customer_order_id}:${line.product_id}`;
    const shipped = shippedByLine.get(key) ?? 0;
    return {
      customer_order_id: line.customer_order_id,
      product_id: line.product_id,
      status: line.status,
      type,
      qty: line.qty == null ? null : Number(line.qty),
      price: Number(line.price ?? 0),
      label: product?.name?.trim() || (type === 1 ? model?.name?.trim() || "Product" : "Charge"),
      item_id: model?.item_id ?? null,
      item_name: item?.name?.trim() || "Item",
      size_chart_id: product?.size_chart_id ?? null,
      sizes: (sizesByProduct.get(line.product_id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      drops: (dropsByProduct.get(line.product_id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      ordered: (cellsByLine.get(key) ?? []).reduce((sum, cell) => sum + Number(cell.qty || 0), 0),
      shipped,
      shipped_value: shipped * Number(line.price ?? 0) + (shippedExtraByLine.get(key) ?? 0),
      cells: cellsByLine.get(key) ?? [],
    };
  });

  return <OrdersWorkspace rows={rows} lines={lines} seasons={asSeasonRows(seasonRows ?? [])} />;
}
