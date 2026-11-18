import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { PRODUCT_TYPE } from "@/lib/product-type";
import { DraftOrdersWorkspace } from "./DraftOrdersWorkspace";
import type { DraftOrderLine, DraftOrderRow } from "./types";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function addressLines(
  row: Record<string, string | null>,
  prefix: "ship" | "bill",
) {
  const city = [row[`${prefix}_city`], row[`${prefix}_region`], row[`${prefix}_postal_code`]]
    .filter(Boolean)
    .join(", ");
  return [row[`${prefix}_address_line1`], row[`${prefix}_address_line2`], city || null, row[`${prefix}_country`]].filter(
    (line): line is string => Boolean(line),
  );
}

export default async function DraftOrdersPage() {
  const profile = await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("customer_order_requests")
    .select(
      "id, request_no, customer_id, status, created_at, future_season, start_date, cancel_date, terms, shipping_method, transmission_method, notes, staff_reply, customer_acceptance, ship_address_line1, ship_address_line2, ship_city, ship_region, ship_postal_code, ship_country, bill_address_line1, bill_address_line2, bill_city, bill_region, bill_postal_code, bill_country, customers ( company_name, account_no, account_number, sales_rep_id )",
    )
    .order("request_no", { ascending: false });

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
    ids.length
      ? supabase
          .from("customer_order_request_cells")
          .select("request_id, product_id, size_id, drop_id, qty, price")
          .in("request_id", ids)
      : Promise.resolve({
          data: [] as {
            request_id: string;
            product_id: string;
            size_id: string;
            drop_id: string;
            qty: number;
            price: number | null;
          }[],
        }),
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

  const repIds = [
    ...new Set(
      (requests ?? [])
        .map((row) => {
          const customer = one<{ sales_rep_id: string | null }>(
            row.customers as { sales_rep_id: string | null } | { sales_rep_id: string | null }[],
          );
          return customer?.sales_rep_id ?? null;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: reps } = repIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", repIds)
    : { data: [] as { id: string; display_name: string }[] };
  const repName = new Map((reps ?? []).map((rep) => [rep.id, rep.display_name?.trim() || ""]));

  const rows: DraftOrderRow[] = (requests ?? []).map((row) => {
    const customer = one<{
      company_name: string | null;
      account_no: number | null;
      account_number: string | null;
      sales_rep_id: string | null;
    }>(row.customers as never);
    const fields = row as unknown as Record<string, string | null>;
    return {
      id: row.id,
      request_no: row.request_no,
      customer_id: row.customer_id,
      customer: customer?.company_name?.trim() || "Customer",
      account_no: customer?.account_no ?? null,
      account: customer?.account_number?.trim() || null,
      sales_rep: customer?.sales_rep_id ? repName.get(customer.sales_rep_id) || null : null,
      created_at: String(row.created_at).slice(0, 10),
      future_season: row.future_season,
      start_date: row.start_date,
      cancel_date: row.cancel_date,
      terms: row.terms,
      shipping_method: row.shipping_method,
      transmission_method: row.transmission_method,
      notes: row.notes,
      staff_reply: row.staff_reply,
      customer_acceptance: row.customer_acceptance,
      status: row.status,
      ship: addressLines(fields, "ship"),
      bill: addressLines(fields, "bill"),
    };
  });
  const orderLines: DraftOrderLine[] = (lines ?? []).map((line) => {
    const product = one<{
      name: string | null;
      type: number | null;
      models: { items: { name: string | null } | { name: string | null }[] | null } | null;
    }>(line.products as never);
    const model = one(product?.models ?? null);
    const item = one(model?.items ?? null);
    const price = Number(line.price ?? 0);
    const cells = cellsByLine.get(`${line.request_id}:${line.product_id}`) ?? [];
    const type = product?.type ?? PRODUCT_TYPE.merchandise;
    const ordered =
      type === PRODUCT_TYPE.merchandise
        ? cells.reduce((sum, cell) => sum + cell.qty, 0)
        : Math.max(0, Number(line.qty ?? 0));
    const extended =
      type === PRODUCT_TYPE.merchandise
        ? cells.reduce((sum, cell) => sum + cell.qty * (price + Number(cell.upcharge ?? 0)), 0)
        : ordered * price;
    return {
      request_id: line.request_id,
      product_id: line.product_id,
      name: product?.name?.trim() || "Product",
      price,
      type,
      item: item?.name?.trim() || null,
      ordered,
      extended,
      sizes: (sizesByProduct.get(line.product_id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      drops: (dropsByProduct.get(line.product_id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      cells,
    };
  });

  return (
    <DraftOrdersWorkspace
      rows={rows}
      lines={orderLines}
      canAct={profile.role === "admin" || profile.role === "warehouse"}
    />
  );
}
