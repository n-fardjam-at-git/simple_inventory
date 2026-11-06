import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { CustomerOrdersWorkspace } from "./CustomerOrdersWorkspace";
import type { CustomerOrderRow } from "./CustomerOrdersTable";
import type { CatalogChoice, ChargeChoice, OrderProductLine, SetItem } from "./OrderProductsPanel";
import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { asSeasonRows } from "@/lib/season";

function one<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export default async function CustomerOrdersPage() {
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("customer_orders")
    .select(
      "id, order_no, created_at, customer_id, status, start_date, cancel_date, future_season, terms, shipment_method_id, shipping_method, transmission_method_id, transmission_method, sales_rep_id, created_by, notes, ship_address_line1, ship_address_line2, ship_city, ship_region, ship_postal_code, ship_country, bill_address_line1, bill_address_line2, bill_city, bill_region, bill_postal_code, bill_country, customers ( account_no, company_name, account_number ), shipment_methods ( shipper, method ), transmission_methods ( name )",
    )
    .order("order_no", { ascending: false });
  const peopleIds = [
    ...new Set(
      (orders ?? [])
        .flatMap((order) => [order.sales_rep_id, order.created_by])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: people } = peopleIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", peopleIds)
    : { data: [] as { id: string; display_name: string }[] };
  const personName = (id: string | null) =>
    (people ?? []).find((person) => person.id === id)?.display_name?.trim() || null;
  const addressLines = (order: Record<string, unknown>, prefix: "ship" | "bill") => {
    const text = (key: string) => {
      const value = order[`${prefix}_${key}`];
      return typeof value === "string" ? value.trim() : "";
    };
    const cityLine = [text("city"), [text("region"), text("postal_code")].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    return [text("address_line1"), text("address_line2"), cityLine, text("country")].filter(Boolean);
  };
  const { data: customers } = await supabase
    .from("customers")
    .select("id, account_no, company_name, account_number, payment_terms ( term )")
    .eq("is_active", true)
    .order("company_name");
  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("id, customer_id, address_type, location_name, city, address_line1");
  const { data: shipmentMethods } = await supabase
    .from("shipment_methods")
    .select("id, shipper, method")
    .eq("is_active", true)
    .order("sort_order");
  const { data: transmissionMethods } = await supabase
    .from("transmission_methods")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");
  const { data: paymentTerms } = await supabase
    .from("payment_terms")
    .select("term, days_due")
    .order("term");
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, year, start_season, is_combo, season");
  const { data: setItemRows } = await supabase
    .from("items")
    .select("id, name")
    .eq("in_set", true)
    .order("name")
    .limit(14);
  const { data: lineRows } = await supabase
    .from("customer_order_products")
    .select(
      "customer_order_id, product_id, price, qty, status, products ( name, type, size_chart_id, models ( name, item_id, items ( name ) ) )",
    );
  const { data: cellRows } = await supabase
    .from("customer_order_cells")
    .select("customer_order_id, product_id, size_id, drop_id, qty, qty_shipped, price");
  const { data: catalogRows } = await supabase
    .from("products")
    .select("id, name, models ( name, item_id )")
    .eq("type", 1)
    .eq("is_active", true)
    .order("name");
  const { data: chargeRows } = await supabase
    .from("products")
    .select("id, type, name, standard_price")
    .in("type", [2, 3])
    .eq("is_active", true)
    .order("type")
    .order("name");
  const productIds = [...new Set((lineRows ?? []).map((line) => line.product_id))];
  const { data: sizeRows } = productIds.length
    ? await supabase
        .from("product_sizes")
        .select("product_id, size_chart_sizes ( id, code, sort_order )")
        .in("product_id", productIds)
    : { data: [] };
  const { data: dropRows } = productIds.length
    ? await supabase
        .from("product_drops")
        .select("product_id, size_chart_drops ( id, code, sort_order )")
        .in("product_id", productIds)
    : { data: [] };

  const merchandiseLine = new Set(
    (lineRows ?? [])
      .filter((line) => {
        const product = one<{ type: number | null }>(line.products);
        return (product?.type ?? 1) === 1;
      })
      .map((line) => `${line.customer_order_id}:${line.product_id}`),
  );
  const leftByOrder = new Map<string, number>();
  for (const cell of cellRows ?? []) {
    const key = `${cell.customer_order_id}:${cell.product_id}`;
    if (!merchandiseLine.has(key)) continue;
    const left = Number(cell.qty ?? 0) - Number(cell.qty_shipped ?? 0);
    leftByOrder.set(cell.customer_order_id, (leftByOrder.get(cell.customer_order_id) ?? 0) + left);
  }

  const rows: CustomerOrderRow[] = (orders ?? []).map((order) => {
    const customer = one<{
      account_no: number;
      company_name: string;
      account_number: string | null;
    }>(order.customers);
    const shipmentMethod = one<{ shipper: string | null; method: string }>(order.shipment_methods);
    const transmissionMethod = one<{ name: string }>(order.transmission_methods);
    return {
      id: order.id,
      order_no: order.order_no,
      created_date: order.created_at ? String(order.created_at).slice(0, 10) : null,
      customer_id: order.customer_id,
      customer: customer?.company_name ?? "",
      account_no: customer?.account_no ?? null,
      account: customer?.account_number ?? "—",
      start_date: order.start_date,
      cancel_date: order.cancel_date ?? null,
      status: order.status,
      left_to_ship:
        order.status === "complete" || order.status === "canceled"
          ? 0
          : Math.max(0, leftByOrder.get(order.id) ?? 0),
      future_season: order.future_season ?? null,
      terms: order.terms ?? null,
      shipment_method_id: order.shipment_method_id ?? null,
      shipping_method:
        order.shipping_method?.trim() ||
        (shipmentMethod
          ? shipmentMethod.shipper
            ? `${shipmentMethod.shipper} · ${shipmentMethod.method}`
            : shipmentMethod.method
          : null),
      transmission_method_id: order.transmission_method_id ?? null,
      transmission_method: order.transmission_method?.trim() || transmissionMethod?.name || null,
      sales_rep: personName(order.sales_rep_id),
      created_by: personName(order.created_by),
      notes: order.notes ?? null,
      ship_line1: order.ship_address_line1 ?? null,
      ship_city: order.ship_city ?? null,
      bill_line1: order.bill_address_line1 ?? null,
      bill_city: order.bill_city ?? null,
      ship_to: addressLines(order as Record<string, unknown>, "ship"),
      bill_to: addressLines(order as Record<string, unknown>, "bill"),
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
  /** Shipped quantity times the size extra, summed per line. The line price is added per shipped unit later. */
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
        | {
            name: string | null;
            item_id: string | null;
            items: { name: string | null } | { name: string | null }[] | null;
          }[]
        | null;
    }>(line.products);
    const model = one<{
      name: string | null;
      item_id: string | null;
      items: { name: string | null } | { name: string | null }[] | null;
    }>(product?.models ?? null);
    const item = one<{ name: string | null }>(model?.items ?? null);
    const type = product?.type ?? 1;
    return {
      customer_order_id: line.customer_order_id,
      product_id: line.product_id,
      status: line.status,
      type,
      qty: line.qty == null ? null : Number(line.qty),
      price: Number(line.price ?? 0),
      label:
        product?.name?.trim() ||
        (type === 1 ? model?.name?.trim() || "Product" : "Charge"),
      item_id: model?.item_id ?? null,
      item_name: item?.name?.trim() || "Item",
      size_chart_id: product?.size_chart_id ?? null,
      sizes: sizesByProduct.get(line.product_id) ?? [],
      drops: dropsByProduct.get(line.product_id) ?? [],
      ordered: (cellsByLine.get(`${line.customer_order_id}:${line.product_id}`) ?? []).reduce(
        (sum, cell) => sum + Number(cell.qty || 0),
        0,
      ),
      shipped: shippedByLine.get(`${line.customer_order_id}:${line.product_id}`) ?? 0,
      shipped_value:
        (shippedByLine.get(`${line.customer_order_id}:${line.product_id}`) ?? 0) *
          Number(line.price ?? 0) +
        (shippedExtraByLine.get(`${line.customer_order_id}:${line.product_id}`) ?? 0),
      cells: cellsByLine.get(`${line.customer_order_id}:${line.product_id}`) ?? [],
    };
  });
  const charges: ChargeChoice[] = (chargeRows ?? []).map((product) => ({
    id: product.id,
    type: product.type,
    price: Number(product.standard_price ?? 0),
    label: product.name?.trim() || "Charge",
  }));
  const catalog: CatalogChoice[] = (catalogRows ?? []).map((product) => {
    const model = one<{ name: string | null; item_id: string | null }>(product.models);
    return {
      id: product.id,
      label: product.name?.trim() || model?.name?.trim() || "Product",
      item_id: model?.item_id ?? null,
    };
  });
  const setItems: SetItem[] = setItemRows ?? [];

  return (
    <div>
      <CustomerOrdersWorkspace
        rows={rows}
        customers={(customers ?? []).map((customer) => ({
          id: customer.id,
          account_no: customer.account_no,
          company_name: customer.company_name,
          account_number: customer.account_number,
          term: one<{ term: string }>(customer.payment_terms)?.term ?? null,
        }))}
        addresses={addresses ?? []}
        shipmentMethods={shipmentMethods ?? []}
        transmissionMethods={transmissionMethods ?? []}
        seasons={asSeasonRows(seasons ?? [])}
        terms={(paymentTerms ?? []).map((term) => ({
          term: term.term,
          days_due: term.days_due,
        }))}
        lines={lines}
        setItems={setItems}
        catalog={catalog}
        charges={charges}
      />
    </div>
  );
}
