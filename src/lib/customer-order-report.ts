import { createClient } from "@/lib/supabase/server";
import { isNoDropAxis, visibleDrops } from "@/lib/size-code";
import { PRODUCT_TYPE } from "@/lib/product-type";
import { summarizeOrder, type ItemTotal, type OrderTotals } from "@/lib/order-summary";

function rel<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export type OrderReportSize = { id: string; code: string; sort_order: number };
export type OrderReportDrop = { id: string; code: string; sort_order: number };
export type OrderReportCell = {
  size_id: string;
  drop_id: string;
  qty: number;
  qty_shipped: number;
  extra: number;
};

export type OrderReportLine = {
  product_id: string;
  type: number;
  name: string;
  status: string;
  price: number;
  /** Surcharge quantity. Freight is 1. Merchandise is null. */
  qty: number | null;
  lot_no: string | null;
  article: string | null;
  model: string | null;
  item: string | null;
  fabric: string | null;
  sizes: OrderReportSize[];
  drops: OrderReportDrop[];
  hide_drop: boolean;
  cells: OrderReportCell[];
  ordered: number;
  shipped: number;
  extended: number;
  shipped_value: number;
};

export type OrderReportItemTotal = ItemTotal;

/** The shared totals (see `order-summary.ts`) plus two counts only the report prints. */
export type OrderReportSummary = OrderTotals & {
  products: number;
  charge_qty: number;
};

export type CustomerOrderReport = {
  order_id: string;
  order_no: number;
  status: string;
  company: string;
  customer: string;
  account_no: number | null;
  sage: string | null;
  terms: string | null;
  shipping_method: string | null;
  transmission_method: string | null;
  future_season: string | null;
  start_date: string | null;
  cancel_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  sales_rep: string | null;
  created_by: string | null;
  updated_by: string | null;
  ship_to: string[];
  bill_to: string[];
  notes: string | null;
  merchandise: OrderReportLine[];
  charges: OrderReportLine[];
  summary: OrderReportSummary;
};

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

export async function loadCustomerOrderReport(
  orderId: string,
): Promise<CustomerOrderReport | null> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("customer_orders")
    .select(
      "*, customers ( account_no, company_name, account_number ), shipment_methods ( shipper, method ), transmission_methods ( name )",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;

  const { data: company } = await supabase
    .from("company_profile")
    .select("trade_name")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();

  const peopleIds = [order.sales_rep_id, order.created_by, order.updated_by].filter(
    (id): id is string => Boolean(id),
  );
  const { data: people } = peopleIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", peopleIds)
    : { data: [] as { id: string; display_name: string }[] };
  const personName = (id: string | null) =>
    (people ?? []).find((person) => person.id === id)?.display_name?.trim() || null;

  const { data: lineRows } = await supabase
    .from("customer_order_products")
    .select(
      "product_id, price, qty, status, products ( name, type, lots ( lot_no, article, color_num, colors ( name ), patterns ( name ), contents ( name ) ), models ( name, items ( name ) ) )",
    )
    .eq("customer_order_id", orderId);
  const { data: cellRows } = await supabase
    .from("customer_order_cells")
    .select("product_id, size_id, drop_id, qty, qty_shipped, price")
    .eq("customer_order_id", orderId);

  const productIds = [...new Set((lineRows ?? []).map((line) => line.product_id))];
  const { data: sizeRows } = productIds.length
    ? await supabase
        .from("product_sizes")
        .select("product_id, size_chart_sizes ( id, code, sort_order )")
        .in("product_id", productIds)
    : { data: [] as { product_id: string; size_chart_sizes: unknown }[] };
  const { data: dropRows } = productIds.length
    ? await supabase
        .from("product_drops")
        .select("product_id, size_chart_drops ( id, code, sort_order )")
        .in("product_id", productIds)
    : { data: [] as { product_id: string; size_chart_drops: unknown }[] };

  type Named = { name: string | null } | { name: string | null }[] | null;
  const lines: OrderReportLine[] = (lineRows ?? []).map((line) => {
    const product = rel<{
      name: string | null;
      type: number | null;
      lots:
        | {
            lot_no: string | null;
            article: string | null;
            color_num: string | null;
            colors: Named;
            patterns: Named;
            contents: Named;
          }
        | null
        | unknown[];
      models: { name: string | null; items: Named } | null | unknown[];
    }>(line.products);
    const lot = rel<{
      lot_no: string | null;
      article: string | null;
      color_num: string | null;
      colors: Named;
      patterns: Named;
      contents: Named;
    }>(product?.lots ?? null);
    const model = rel<{ name: string | null; items: Named }>(product?.models ?? null);
    const item = rel<{ name: string | null }>(model?.items ?? null);
    const type = product?.type ?? PRODUCT_TYPE.merchandise;
    const price = Number(line.price ?? 0);

    const sizes = (sizeRows ?? [])
      .filter((row) => row.product_id === line.product_id)
      .map((row) => rel<OrderReportSize>(row.size_chart_sizes))
      .filter((size): size is OrderReportSize => Boolean(size))
      .sort((a, b) => a.sort_order - b.sort_order);
    const allDrops = (dropRows ?? [])
      .filter((row) => row.product_id === line.product_id)
      .map((row) => rel<OrderReportDrop>(row.size_chart_drops))
      .filter((drop): drop is OrderReportDrop => Boolean(drop))
      .sort((a, b) => a.sort_order - b.sort_order);
    const cells: OrderReportCell[] = (cellRows ?? [])
      .filter((cell) => cell.product_id === line.product_id)
      .map((cell) => ({
        size_id: cell.size_id,
        drop_id: cell.drop_id,
        qty: Number(cell.qty ?? 0),
        qty_shipped: Number(cell.qty_shipped ?? 0),
        extra: cell.price == null ? 0 : Number(cell.price),
      }))
      .filter((cell) => cell.qty > 0 || cell.qty_shipped > 0);
    const usedDrops = new Set(cells.map((cell) => cell.drop_id));
    const hide_drop = isNoDropAxis(allDrops);
    const drops = (hide_drop ? allDrops : visibleDrops(allDrops)).filter((drop) =>
      usedDrops.has(drop.id),
    );

    const merchandise = type === PRODUCT_TYPE.merchandise;
    const chargeQty = type === PRODUCT_TYPE.freight ? 1 : Math.max(0, Number(line.qty ?? 0));
    const ordered = merchandise ? cells.reduce((sum, cell) => sum + cell.qty, 0) : chargeQty;
    const shipped = merchandise ? cells.reduce((sum, cell) => sum + cell.qty_shipped, 0) : 0;
    const extended = merchandise
      ? cells.reduce((sum, cell) => sum + cell.qty * (price + cell.extra), 0)
      : chargeQty * price;
    const shipped_value = merchandise
      ? cells.reduce((sum, cell) => sum + cell.qty_shipped * (price + cell.extra), 0)
      : 0;

    const fabric = [
      rel<{ name: string | null }>(lot?.colors ?? null)?.name,
      rel<{ name: string | null }>(lot?.patterns ?? null)?.name,
      rel<{ name: string | null }>(lot?.contents ?? null)?.name,
    ]
      .map((part) => part?.trim() || "")
      .filter(Boolean)
      .join(" ");

    return {
      product_id: line.product_id,
      type,
      name: product?.name?.trim() || model?.name?.trim() || (merchandise ? "Product" : "Charge"),
      status: line.status,
      price,
      qty: merchandise ? null : chargeQty,
      lot_no: lot?.lot_no?.trim() || null,
      article: lot?.article?.trim() || null,
      model: model?.name?.trim() || null,
      item: item?.name?.trim() || null,
      fabric: fabric || null,
      sizes,
      drops,
      hide_drop,
      cells,
      ordered,
      shipped,
      extended,
      shipped_value,
    };
  });

  const byName = (a: OrderReportLine, b: OrderReportLine) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  const merchandise = lines.filter((line) => line.type === PRODUCT_TYPE.merchandise).sort(byName);
  const charges = lines
    .filter((line) => line.type !== PRODUCT_TYPE.merchandise)
    .sort((a, b) => a.type - b.type || byName(a, b));

  const open = (line: OrderReportLine) => line.status !== "canceled";
  const openMerch = merchandise.filter(open);
  const openSurcharge = charges.filter((line) => open(line) && line.type === PRODUCT_TYPE.surcharge);
  const totals = summarizeOrder(lines);

  const customer = rel<{
    account_no: number;
    company_name: string;
    account_number: string | null;
  }>(order.customers);
  const shipmentMethod = rel<{ shipper: string | null; method: string }>(order.shipment_methods);
  const transmissionMethod = rel<{ name: string }>(order.transmission_methods);
  const shippingName =
    (order.shipping_method as string | null)?.trim() ||
    (shipmentMethod
      ? shipmentMethod.shipper
        ? `${shipmentMethod.shipper} · ${shipmentMethod.method}`
        : shipmentMethod.method
      : null);

  return {
    order_id: order.id,
    order_no: order.order_no,
    status: order.status,
    company: company?.trade_name?.trim() || "Gruppo Bravo",
    customer: customer?.company_name ?? "",
    account_no: customer?.account_no ?? null,
    sage: customer?.account_number?.trim() || null,
    terms: (order.terms as string | null)?.trim() || null,
    shipping_method: shippingName,
    transmission_method:
      (order.transmission_method as string | null)?.trim() || transmissionMethod?.name || null,
    future_season: (order.future_season as string | null)?.trim() || null,
    start_date: order.start_date ?? null,
    cancel_date: order.cancel_date ?? null,
    created_at: order.created_at ?? null,
    updated_at: order.updated_at ?? null,
    sales_rep: personName(order.sales_rep_id),
    created_by: personName(order.created_by),
    updated_by: personName(order.updated_by),
    ship_to: addressLines(order as Record<string, unknown>, "ship"),
    bill_to: addressLines(order as Record<string, unknown>, "bill"),
    notes: (order.notes as string | null)?.trim() || null,
    merchandise,
    charges,
    summary: {
      ...totals,
      products: openMerch.length,
      charge_qty: openSurcharge.reduce((sum, line) => sum + line.ordered, 0),
    },
  };
}
