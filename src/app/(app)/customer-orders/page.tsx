import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { CustomerOrdersWorkspace } from "./CustomerOrdersWorkspace";
import type { CustomerOrderRow } from "./CustomerOrdersTable";
import type { CatalogChoice, OrderProductLine, SetItem } from "./OrderProductsPanel";
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
    .select("id, order_no, customer_id, status, start_date, customers ( account_no, company_name, account_number )")
    .order("order_no", { ascending: false });
  const { data: customers } = await supabase
    .from("customers")
    .select("id, account_no, company_name, account_number")
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
    .select("customer_order_id, product_id, price, status, products ( name, models ( name, item_id ) )");
  const { data: cellRows } = await supabase
    .from("customer_order_cells")
    .select("customer_order_id, product_id, size_id, drop_id, qty, price");
  const { data: catalogRows } = await supabase
    .from("products")
    .select("id, name, models ( name, item_id )")
    .eq("type", 1)
    .eq("is_active", true)
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

  const rows: CustomerOrderRow[] = (orders ?? []).map((order) => {
    const customer = order.customers as unknown as {
      account_no: number;
      company_name: string;
      account_number: string | null;
    } | null;
    return {
      id: order.id,
      order_no: order.order_no,
      customer_id: order.customer_id,
      customer: customer?.company_name ?? "",
      account_no: customer?.account_no ?? null,
      account: customer?.account_number ?? "—",
      start_date: order.start_date,
      status: order.status,
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
  }
  const lines: OrderProductLine[] = (lineRows ?? []).map((line) => {
    const product = one<{ name: string | null; models: { name: string | null } | { name: string | null }[] | null }>(
      line.products,
    );
    const model = one<{ name: string | null }>(product?.models ?? null);
    return {
      customer_order_id: line.customer_order_id,
      product_id: line.product_id,
      status: line.status,
      price: Number(line.price ?? 0),
      label: model?.name?.trim() || product?.name?.trim() || "Product",
      sizes: sizesByProduct.get(line.product_id) ?? [],
      drops: dropsByProduct.get(line.product_id) ?? [],
      cells: cellsByLine.get(`${line.customer_order_id}:${line.product_id}`) ?? [],
    };
  });
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
      <PageTitle title="Customer orders" />
      <CustomerOrdersWorkspace
        rows={rows}
        customers={customers ?? []}
        addresses={addresses ?? []}
        shipmentMethods={shipmentMethods ?? []}
        transmissionMethods={transmissionMethods ?? []}
        seasons={asSeasonRows(seasons ?? [])}
        lines={lines}
        setItems={setItems}
        catalog={catalog}
      />
    </div>
  );
}
