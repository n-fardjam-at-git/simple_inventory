import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { PRODUCT_TYPE } from "@/lib/product-type";
import { DraftOrdersWorkspace } from "./DraftOrdersWorkspace";
import { ONLINE_BY_SALES_REP, shipmentMethodLabel } from "@/lib/customer-order";
import { asSeasonRows } from "@/lib/season";
import type { DraftChoice, DraftMethod, DraftOrderLine, DraftOrderRow, ProposalChoices } from "./types";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function addressLines(
  row: Record<string, string | null>,
  prefix: "ship" | "bill",
) {
  const city = [
    row[`${prefix}_city`],
    row[`${prefix}_region`],
    row[`${prefix}_postal_code`],
    row[`${prefix}_country`],
  ]
    .filter(Boolean)
    .join(", ");
  return [row[`${prefix}_address_line1`], row[`${prefix}_address_line2`], city || null].filter(
    (line): line is string => Boolean(line),
  );
}

export default async function DraftOrdersPage() {
  const profile = await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("customer_order_requests")
    .select(
      "id, request_no, customer_id, status, created_at, future_season, start_date, cancel_date, terms, shipment_method_id, shipping_method, transmission_method, sales_rep_id, notes, staff_reply, customer_acceptance, ship_address_line1, ship_address_line2, ship_city, ship_region, ship_postal_code, ship_country, bill_address_line1, bill_address_line2, bill_city, bill_region, bill_postal_code, bill_country, customers ( company_name, account_no, account_number, user_id )",
    )
    .order("request_no", { ascending: false });

  const ids = (requests ?? []).map((row) => row.id);
  const { data: lines } = ids.length
    ? await supabase
        .from("customer_order_request_products")
        .select(
          "request_id, product_id, price, qty, products ( name, type, size_chart_id, models ( item_id, items ( name ) ) )",
        )
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

  const { data: salesRepRows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("role", "sales_rep")
    .order("display_name");
  const salesReps: DraftChoice[] = (salesRepRows ?? []).map((rep) => ({
    id: rep.id,
    label: rep.display_name?.trim() || "Sales rep",
  }));
  const knownReps = new Set(salesReps.map((rep) => rep.id));
  const missingReps = [
    ...new Set(
      (requests ?? [])
        .map((row) => row.sales_rep_id)
        .filter((id): id is string => Boolean(id) && !knownReps.has(id)),
    ),
  ];
  const { data: extraReps } = missingReps.length
    ? await supabase.from("profiles").select("id, display_name").in("id", missingReps)
    : { data: [] as { id: string; display_name: string | null }[] };
  const repName = new Map<string, string>([
    ...salesReps.map((rep) => [rep.id, rep.label] as const),
    ...(extraReps ?? []).map((rep) => [rep.id, rep.display_name?.trim() || "Sales rep"] as const),
  ]);

  const isRep = profile.role === "sales_rep";
  const { data: loginRows } = await supabase
    .from("profiles")
    .select("customer_id")
    .eq("role", "customer")
    .not("customer_id", "is", null);
  const withLogin = new Set((loginRows ?? []).map((row) => row.customer_id));

  const rows: DraftOrderRow[] = (requests ?? []).map((row) => {
    const customer = one<{
      company_name: string | null;
      account_no: number | null;
      account_number: string | null;
      user_id: string | null;
    }>(row.customers as never);
    const fields = row as unknown as Record<string, string | null>;
    return {
      id: row.id,
      request_no: row.request_no,
      customer_id: row.customer_id,
      customer: customer?.company_name?.trim() || "Customer",
      account_no: customer?.account_no ?? null,
      account: customer?.account_number?.trim() || null,
      sales_rep_id: row.sales_rep_id,
      sales_rep: row.sales_rep_id ? repName.get(row.sales_rep_id) || null : null,
      created_at: String(row.created_at).slice(0, 10),
      future_season: row.future_season,
      start_date: row.start_date,
      cancel_date: row.cancel_date,
      terms: row.terms,
      shipment_method_id: row.shipment_method_id,
      shipping_method: row.shipping_method,
      notes: row.notes,
      staff_reply: row.staff_reply,
      customer_acceptance: row.customer_acceptance,
      status: row.status,
      ship: addressLines(fields, "ship"),
      bill: addressLines(fields, "bill"),
      ship_line1: row.ship_address_line1,
      ship_city: row.ship_city,
      bill_line1: row.bill_address_line1,
      bill_city: row.bill_city,
      rep_entered: row.transmission_method === ONLINE_BY_SALES_REP,
      customer_has_login: Boolean(customer?.user_id) || withLogin.has(row.customer_id),
    };
  });
  const orderLines: DraftOrderLine[] = (lines ?? []).map((line) => {
    const product = one<{
      name: string | null;
      type: number | null;
      size_chart_id: string | null;
      models: {
        item_id: string | null;
        items: { name: string | null } | { name: string | null }[] | null;
      } | null;
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
      qty: line.qty == null ? null : Number(line.qty),
      type,
      item: item?.name?.trim() || null,
      item_id: model?.item_id ?? null,
      size_chart_id: product?.size_chart_id ?? null,
      ordered,
      extended,
      sizes: (sizesByProduct.get(line.product_id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      drops: (dropsByProduct.get(line.product_id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      cells,
    };
  });

  const [{ data: setItemRows }, { data: catalogRows }, { data: chargeRows }, { data: termRows }, { data: methodRows }] =
    await Promise.all([
    supabase.from("items").select("id, name").eq("in_set", true).order("name").limit(14),
    supabase
      .from("products")
      .select("id, name, models ( name, item_id )")
      .eq("type", 1)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("products")
      .select("id, type, name, standard_price")
      .in("type", [2, 3])
      .eq("is_active", true)
      .order("type")
      .order("name"),
    supabase.from("payment_terms").select("term, days_due").order("term"),
    supabase.from("shipment_methods").select("id, shipper, method, is_active").order("sort_order"),
  ]);

  let choices: ProposalChoices | null = null;
  if (isRep) {
    const [{ data: customerRows }, { data: addressRows }, { data: seasonRows }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, account_no, company_name, account_number, payment_terms ( term )")
        .eq("is_active", true)
        .eq("sales_rep_id", profile.id)
        .order("company_name"),
      supabase
        .from("customer_addresses")
        .select("id, customer_id, address_type, location_name, city, address_line1"),
      supabase.from("seasons").select("id, year, start_season, is_combo, season"),
    ]);
    choices = {
      customers: (customerRows ?? []).map((customer) => ({
        id: customer.id,
        account_no: customer.account_no,
        company_name: customer.company_name,
        account_number: customer.account_number,
        term: one<{ term: string }>(customer.payment_terms as never)?.term ?? null,
      })),
      addresses: addressRows ?? [],
      shipmentMethods: (methodRows ?? [])
        .filter((method) => method.is_active)
        .map((method) => ({ id: method.id, shipper: method.shipper, method: method.method })),
      seasons: asSeasonRows(seasonRows ?? []),
      terms: (termRows ?? []).map((term) => ({ term: term.term, days_due: term.days_due })),
    };
  }
  const terms: DraftChoice[] = (termRows ?? []).map((term) => ({ id: term.term, label: term.term }));
  const shipmentMethods: DraftMethod[] = (methodRows ?? []).map((method) => ({
    id: method.id,
    label: shipmentMethodLabel(method),
    active: method.is_active,
  }));

  return (
    <DraftOrdersWorkspace
      rows={rows}
      lines={orderLines}
      canAct={profile.role === "admin" || profile.role === "warehouse"}
      choices={choices}
      setItems={setItemRows ?? []}
      catalog={(catalogRows ?? []).map((product) => {
        const model = one<{ name: string | null; item_id: string | null }>(product.models as never);
        return {
          id: product.id,
          label: product.name?.trim() || model?.name?.trim() || "Product",
          item_id: model?.item_id ?? null,
        };
      })}
      charges={(chargeRows ?? []).map((product) => ({
        id: product.id,
        type: product.type,
        price: Number(product.standard_price ?? 0),
        label: product.name?.trim() || "Charge",
      }))}
      terms={terms}
      shipmentMethods={shipmentMethods}
      salesReps={salesReps}
    />
  );
}
