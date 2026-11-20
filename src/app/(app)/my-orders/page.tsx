import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { asSeasonRows } from "@/lib/season";
import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { MyOrdersWorkspace } from "./MyOrdersWorkspace";
import type { RequestCatalogChoice, RequestLine, RequestOrder, RequestSetItem } from "./types";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function addressLines(row: {
  ship_address_line1: string | null;
  ship_address_line2: string | null;
  ship_city: string | null;
  ship_region: string | null;
  ship_postal_code: string | null;
  ship_country: string | null;
  bill_address_line1: string | null;
  bill_address_line2: string | null;
  bill_city: string | null;
  bill_region: string | null;
  bill_postal_code: string | null;
  bill_country: string | null;
}, prefix: "ship" | "bill") {
  const city = [row[`${prefix}_city`], row[`${prefix}_region`], row[`${prefix}_postal_code`]]
    .filter(Boolean)
    .join(", ");
  return [row[`${prefix}_address_line1`], row[`${prefix}_address_line2`], city || null, row[`${prefix}_country`]].filter(
    (line): line is string => Boolean(line),
  );
}

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
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

  const [{ data: requests }, { data: seasons }, { data: addresses }] = await Promise.all([
    supabase
      .from("customer_order_requests")
      .select(
        "id, request_no, status, created_at, future_season, start_date, cancel_date, terms, shipping_method, notes, staff_reply, customer_acceptance, ship_address_line1, ship_address_line2, ship_city, ship_region, ship_postal_code, ship_country, bill_address_line1, bill_address_line2, bill_city, bill_region, bill_postal_code, bill_country",
      )
      .eq("customer_id", customerId)
      .order("request_no", { ascending: false }),
    supabase.from("seasons").select("id, year, start_season, is_combo, season"),
    supabase
      .from("customer_addresses")
      .select("id, address_type, location_name, address_line1, city")
      .eq("customer_id", customerId),
  ]);
  const ids = (requests ?? []).map((row) => row.id);
  const { data: lines } = ids.length
    ? await supabase
        .from("customer_order_request_products")
        .select("request_id, product_id, price, qty, products ( name, type, models ( items ( name ) ) )")
        .in("request_id", ids)
    : { data: [] };
  const productIds = [...new Set((lines ?? []).map((line) => line.product_id))];
  const [{ data: sizeRows }, { data: dropRows }, { data: cellRows }] = await Promise.all([
    productIds.length
      ? supabase.from("product_sizes").select("product_id, size_chart_sizes ( id, code, sort_order )").in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string; size_chart_sizes: unknown }[] }),
    productIds.length
      ? supabase.from("product_drops").select("product_id, size_chart_drops ( id, code, sort_order )").in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string; size_chart_drops: unknown }[] }),
    ids.length
      ? supabase
          .from("customer_order_request_cells")
          .select("request_id, product_id, size_id, drop_id, qty, price")
          .in("request_id", ids)
      : Promise.resolve({ data: [] as { request_id: string; product_id: string; size_id: string; drop_id: string; qty: number; price: number | null }[] }),
  ]);

  const sizesByProduct = new Map<string, MatrixSize[]>();
  for (const row of sizeRows ?? []) {
    const size = one<MatrixSize>(row.size_chart_sizes as MatrixSize | MatrixSize[] | null);
    if (!size) continue;
    const list = sizesByProduct.get(row.product_id) ?? [];
    list.push(size);
    sizesByProduct.set(row.product_id, list);
  }
  const dropsByProduct = new Map<string, MatrixDrop[]>();
  for (const row of dropRows ?? []) {
    const drop = one<MatrixDrop>(row.size_chart_drops as MatrixDrop | MatrixDrop[] | null);
    if (!drop) continue;
    const list = dropsByProduct.get(row.product_id) ?? [];
    list.push(drop);
    dropsByProduct.set(row.product_id, list);
  }
  const cellsByLine = new Map<string, Cell[]>();
  for (const cell of cellRows ?? []) {
    const key = `${cell.request_id}:${cell.product_id}`;
    const list = cellsByLine.get(key) ?? [];
    list.push({
      size_id: cell.size_id,
      drop_id: cell.drop_id,
      qty: Number(cell.qty ?? 0),
      upcharge: cell.price == null ? null : Number(cell.price),
    });
    cellsByLine.set(key, list);
  }

  const orders: RequestOrder[] = (requests ?? []).map((row) => ({
    id: row.id,
    request_no: row.request_no,
    status: row.status,
    created_at: String(row.created_at).slice(0, 10),
    future_season: row.future_season,
    start_date: row.start_date,
    cancel_date: row.cancel_date,
    terms: row.terms,
    shipping_method: row.shipping_method,
    notes: row.notes,
    staff_reply: row.staff_reply,
    customer_acceptance: row.customer_acceptance,
    ship: addressLines(row, "ship"),
    bill: addressLines(row, "bill"),
  }));
  const requestLines: RequestLine[] = (lines ?? []).map((line) => {
    const product = one<{
      name: string | null;
      type: number | null;
      models: { items: { name: string | null } | { name: string | null }[] | null } | null;
    }>(line.products as never);
    const model = one(product?.models ?? null);
    const item = one(model?.items ?? null);
    return {
      request_id: line.request_id,
      product_id: line.product_id,
      name: product?.name?.trim() || "Product",
      item: item?.name?.trim() || null,
      price: Number(line.price ?? 0),
      qty: line.qty == null ? null : Number(line.qty),
      type: product?.type ?? 1,
      sizes: sizesByProduct.get(line.product_id) ?? [],
      drops: dropsByProduct.get(line.product_id) ?? [],
      cells: cellsByLine.get(`${line.request_id}:${line.product_id}`) ?? [],
    };
  });
  const [{ data: setItemRows }, { data: catalogRows }] = await Promise.all([
    supabase.from("items").select("id, name").eq("in_set", true).order("name").limit(14),
    supabase
      .from("products")
      .select("id, name, models ( name, item_id )")
      .eq("type", 1)
      .eq("is_active", true)
      .eq("published", true)
      .order("name"),
  ]);
  const setItems: RequestSetItem[] = (setItemRows ?? [])
    .map((item) => ({ id: item.id, name: item.name?.trim() || "" }))
    .filter((item) => item.name);
  const catalog: RequestCatalogChoice[] = (catalogRows ?? []).map((product) => {
    const model = one<{ name: string | null; item_id: string | null }>(product.models as never);
    return {
      id: product.id,
      label: product.name?.trim() || model?.name?.trim() || "Product",
      item_id: model?.item_id ?? null,
    };
  });
  const { open } = await searchParams;

  return (
    <MyOrdersWorkspace
      orders={orders}
      lines={requestLines}
      setItems={setItems}
      catalog={catalog}
      seasons={asSeasonRows(seasons ?? [])}
      addresses={(addresses ?? []).map((address) => ({
        id: address.id,
        address_type: address.address_type,
        location_name: address.location_name,
        city: address.city,
        address_line1: address.address_line1,
      }))}
      resumeId={open || null}
    />
  );
}
