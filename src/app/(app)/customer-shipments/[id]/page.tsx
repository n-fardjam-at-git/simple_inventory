import Link from "next/link";
import { DismissNote } from "@/components/DismissNote";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { loadProductMatrix } from "@/lib/products";
import { QtyMatrix } from "@/components/matrix/QtyMatrix";
import { ComboBox } from "@/components/ComboBox";
import { AddForm } from "@/components/AddForm";
import { NumericInput } from "@/components/NumericInput";
import { PriceInput } from "@/components/PriceInput";
import { PageTitle, Card, Btn } from "@/components/ui";
import {
  isOpenShipment,
  shipmentStatusLabel,
  SHIPPABLE_ORDER_STATUS,
} from "@/lib/customer-shipment";
import { PRODUCT_TYPE, productTypeLabel } from "@/lib/product-type";
import {
  addShipmentCharge,
  addShipmentOrder,
  removeShipmentLine,
  saveShipmentCells,
  saveShipmentCharge,
  saveShipmentDetails,
} from "../actions";
import { ShipForm, StatusForm } from "../ShipmentControls";

function one<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type ShipmentCell = { size_id: string; drop_id: string; qty: number; price: number };

function addressLines(shipment: Record<string, unknown>, prefix: "ship" | "bill") {
  const text = (key: string) => {
    const value = shipment[`${prefix}_${key}`];
    return typeof value === "string" ? value.trim() : "";
  };
  const cityLine = [text("city"), [text("region"), text("postal_code")].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [text("address_line1"), text("address_line2"), cityLine, text("country")].filter(Boolean);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="break-words text-stone-900">{value}</dd>
    </div>
  );
}

function Address({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div>
      <p className="text-xs text-stone-500">{title}</p>
      {lines.length ? (
        lines.map((line, index) => <p key={index}>{line}</p>)
      ) : (
        <p className="text-stone-400">—</p>
      )}
    </div>
  );
}

export default async function CustomerShipmentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const profile = await requireRoles(["admin", "warehouse", "sales_rep"]);
  const canWrite = profile.role === "admin" || profile.role === "warehouse";
  const supabase = await createClient();
  const { data: shipment } = await supabase
    .from("customer_shipments")
    .select("*, customers ( account_no, company_name, account_number )")
    .eq("id", id)
    .maybeSingle();
  if (!shipment) {
    return <PageTitle title="Shipment" />;
  }
  const open = isOpenShipment(shipment.status);
  const editable = canWrite && open;
  const customer = one<{
    account_no: number;
    company_name: string;
    account_number: string | null;
  }>(shipment.customers);

  const { data: lineRows } = await supabase
    .from("customer_shipment_products")
    .select(
      "id, customer_order_id, product_id, qty, price, products ( type, name ), customer_orders ( order_no )",
    )
    .eq("customer_shipment_id", id);
  const lineIds = (lineRows ?? []).map((line) => line.id);
  const { data: cellRows } = lineIds.length
    ? await supabase
        .from("customer_shipment_cells")
        .select("customer_shipment_product_id, size_id, drop_id, qty, price")
        .in("customer_shipment_product_id", lineIds)
    : { data: [] };

  const peopleIds = [
    ...new Set(
      [shipment.sales_rep_id, shipment.picker_id, shipment.created_by, shipment.updated_by].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
  const { data: people } = peopleIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", peopleIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const personName = (personId: string | null) =>
    (people ?? []).find((person) => person.id === personId)?.display_name?.trim() || "—";

  const [{ data: pickers }, { data: orders }, { data: charges }] = editable
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name")
          .in("role", ["admin", "warehouse"])
          .order("display_name"),
        supabase
          .from("customer_orders")
          .select("id, order_no, po_no")
          .eq("customer_id", shipment.customer_id)
          .in("status", [...SHIPPABLE_ORDER_STATUS])
          .order("order_no"),
        supabase
          .from("products")
          .select("id, type, name")
          .in("type", [PRODUCT_TYPE.surcharge, PRODUCT_TYPE.freight])
          .eq("is_active", true)
          .order("type")
          .order("name"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const cellsByLine = new Map<string, ShipmentCell[]>();
  for (const cell of cellRows ?? []) {
    const list = cellsByLine.get(cell.customer_shipment_product_id) ?? [];
    list.push({
      size_id: cell.size_id,
      drop_id: cell.drop_id,
      qty: Number(cell.qty ?? 0),
      price: Number(cell.price ?? 0),
    });
    cellsByLine.set(cell.customer_shipment_product_id, list);
  }

  const lines = (lineRows ?? [])
    .map((line) => {
      const product = one<{ type: number | null; name: string | null }>(line.products);
      const type = product?.type ?? PRODUCT_TYPE.merchandise;
      const cells = cellsByLine.get(line.id) ?? [];
      const merchandise = type === PRODUCT_TYPE.merchandise;
      return {
        id: line.id,
        product_id: line.product_id,
        order_no: one<{ order_no: number }>(line.customer_orders)?.order_no ?? null,
        type,
        merchandise,
        name: product?.name?.trim() || productTypeLabel(type),
        qty: Number(line.qty ?? 0),
        price: Number(line.price ?? 0),
        cells,
        units: merchandise ? cells.reduce((sum, cell) => sum + cell.qty, 0) : 0,
        amount: merchandise
          ? cells.reduce((sum, cell) => sum + cell.qty * cell.price, 0)
          : Number(line.qty ?? 0) * Number(line.price ?? 0),
      };
    })
    .sort(
      (a, b) =>
        (a.order_no ?? Number.MAX_SAFE_INTEGER) - (b.order_no ?? Number.MAX_SAFE_INTEGER) ||
        a.type - b.type ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
  const units = lines.reduce((sum, line) => sum + line.units, 0);
  const merchandiseTotal = lines
    .filter((line) => line.merchandise)
    .reduce((sum, line) => sum + line.amount, 0);
  const chargeTotal = lines
    .filter((line) => !line.merchandise)
    .reduce((sum, line) => sum + line.amount, 0);
  const orderNos = [
    ...new Set(lines.map((line) => line.order_no).filter((no): no is number => no != null)),
  ];

  const matrices = new Map(
    await Promise.all(
      [...new Set(lines.filter((line) => line.merchandise).map((line) => line.product_id))].map(
        async (productId) => [productId, await loadProductMatrix(productId)] as const,
      ),
    ),
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title={`Shipment No ${shipment.shipment_no} · ${customer?.company_name ?? ""}`}
        actions={
          <Link className="text-sm underline" href="/customer-shipments">
            All shipments
          </Link>
        }
      />
      {error ? (
        <DismissNote className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {decodeURIComponent(error)}
        </DismissNote>
      ) : null}

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
          <Fact label="Status" value={shipmentStatusLabel(shipment.status)} />
          <Fact label="Date created" value={String(shipment.created_at).slice(0, 10)} />
          <Fact label="Date shipped" value={shipment.date_shipped ?? "—"} />
          <Fact label="Orders" value={orderNos.length ? orderNos.join(", ") : "—"} />
          <Fact label="Account" value={customer?.account_no == null ? "—" : String(customer.account_no)} />
          <Fact label="Sage" value={customer?.account_number ?? "—"} />
          <Fact label="Terms" value={shipment.terms ?? "—"} />
          <Fact label="Shipping method" value={shipment.shipping_method ?? "—"} />
          <Fact label="Sales rep" value={personName(shipment.sales_rep_id)} />
          <Fact label="Picker" value={personName(shipment.picker_id)} />
          <Fact label="Entered by" value={personName(shipment.created_by)} />
          <Fact label="Last updated by" value={personName(shipment.updated_by)} />
          <Fact label="Tracking No" value={shipment.tracking_no ?? "—"} />
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <Address title="Ship to" lines={addressLines(shipment, "ship")} />
          <Address title="Bill to" lines={addressLines(shipment, "bill")} />
        </div>
        {shipment.notes ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-stone-700">{shipment.notes}</p>
        ) : null}
        <p className="mt-4 text-sm font-medium tabular-nums">
          {units} units · {usd.format(merchandiseTotal)} merchandise · {usd.format(chargeTotal)} charges ·{" "}
          {usd.format(merchandiseTotal + chargeTotal)} total
        </p>
      </Card>

      {editable ? (
        <Card>
          <div className="flex flex-wrap items-end gap-6">
            <StatusForm shipmentId={id} status={shipment.status} />
            <ShipForm shipmentId={id} />
          </div>
        </Card>
      ) : null}

      {canWrite && shipment.status !== "canceled" ? (
        <Card>
          <form action={saveShipmentDetails.bind(null, id)} className="flex flex-wrap items-end gap-3 text-sm">
            {editable ? (
              <label>
                <span className="mb-1 block text-xs text-stone-500">Picker</span>
                <select
                  name="picker_id"
                  defaultValue={shipment.picker_id ?? ""}
                  className="rounded border px-2 py-1"
                >
                  <option value="">—</option>
                  {(pickers ?? []).map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.display_name?.trim() || "Staff"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span className="mb-1 block text-xs text-stone-500">Tracking No</span>
              <input
                name="tracking_no"
                defaultValue={shipment.tracking_no ?? ""}
                className="rounded border px-2 py-1"
              />
            </label>
            <label className="min-w-64 flex-1">
              <span className="mb-1 block text-xs text-stone-500">Notes</span>
              <input
                name="notes"
                defaultValue={shipment.notes ?? ""}
                className="w-full rounded border px-2 py-1"
              />
            </label>
            <Btn type="submit">Save</Btn>
          </form>
        </Card>
      ) : null}

      {editable ? (
        <Card>
          <div className="flex flex-wrap items-start gap-6 text-sm">
            <AddForm action={addShipmentOrder.bind(null, id)} className="flex gap-2">
              <ComboBox
                name="customer_order_id"
                required
                placeholder="Order"
                options={(orders ?? []).map((order) => ({
                  id: order.id,
                  label: order.po_no
                    ? `Order No ${order.order_no} · PO ${order.po_no}`
                    : `Order No ${order.order_no}`,
                }))}
              />
              <Btn type="submit">Add order</Btn>
            </AddForm>
            <AddForm action={addShipmentCharge.bind(null, id)} className="flex gap-2">
              <ComboBox
                name="product_id"
                required
                placeholder="Freight or surcharge"
                options={(charges ?? []).map((product) => ({
                  id: product.id,
                  label: product.name?.trim() || productTypeLabel(product.type),
                }))}
              />
              <Btn type="submit">Add charge</Btn>
            </AddForm>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Add order puts every open product of an approved order on the shipment, with what is left to
            ship. A second order needs the same addresses, terms, shipping method, and sales rep.
          </p>
        </Card>
      ) : null}

      {lines.length === 0 ? <p className="text-sm text-stone-500">No products yet.</p> : null}

      {lines.map((line) => {
        const heading = (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium">
              {line.order_no == null ? "No order" : `Order No ${line.order_no}`} · {line.name}
              {line.merchandise ? null : ` · ${productTypeLabel(line.type)}`}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-sm tabular-nums text-stone-700">
                {line.merchandise ? `${line.units} units · ` : null}
                {usd.format(line.amount)}
              </span>
              {editable ? (
                <form action={removeShipmentLine.bind(null, id, line.id)}>
                  <Btn type="submit" className="text-xs text-red-700 underline disabled:opacity-50">
                    Remove
                  </Btn>
                </form>
              ) : null}
            </div>
          </div>
        );

        if (!line.merchandise) {
          const freight = line.type === PRODUCT_TYPE.freight;
          return (
            <Card key={line.id}>
              {heading}
              {editable ? (
                <form
                  action={saveShipmentCharge.bind(null, id, line.id)}
                  className="flex items-end gap-3 text-sm"
                >
                  {freight ? null : (
                    <label>
                      <span className="mb-1 block text-xs text-stone-500">Qty</span>
                      <NumericInput
                        name="qty"
                        inputMode="numeric"
                        defaultValue={line.qty || ""}
                        className="w-20 rounded border px-2 py-1"
                      />
                    </label>
                  )}
                  <label>
                    <span className="mb-1 block text-xs text-stone-500">{freight ? "Cost" : "Price"}</span>
                    <PriceInput
                      name="price"
                      defaultValue={line.price}
                      className="w-28 rounded border px-2 py-1"
                    />
                  </label>
                  <Btn type="submit">Save</Btn>
                </form>
              ) : (
                <p className="text-sm tabular-nums">
                  {freight ? `Cost ${usd.format(line.price)}` : `Qty ${line.qty} · ${usd.format(line.price)}`}
                </p>
              )}
            </Card>
          );
        }

        const matrix = matrices.get(line.product_id);
        const sizeIds = new Set(line.cells.map((cell) => cell.size_id));
        const dropIds = new Set(line.cells.map((cell) => cell.drop_id));
        const sizes = (matrix?.sizes ?? []).filter((size) => sizeIds.has(size.id));
        const drops = (matrix?.drops ?? []).filter((drop) => dropIds.has(drop.id));
        const signature = line.cells
          .map((cell) => `${cell.size_id}:${cell.drop_id}:${cell.qty}`)
          .sort()
          .join("|");
        return (
          <Card key={line.id}>
            {heading}
            {editable ? (
              <form action={saveShipmentCells.bind(null, id, line.id)}>
                <QtyMatrix
                  key={signature}
                  sizes={sizes}
                  drops={drops}
                  cells={line.cells}
                  editable
                  showTotals
                  namePrefix="cell"
                />
                <div className="mt-2">
                  <Btn type="submit">Save qty</Btn>
                </div>
              </form>
            ) : (
              <QtyMatrix key={signature} sizes={sizes} drops={drops} cells={line.cells} showTotals />
            )}
          </Card>
        );
      })}
    </div>
  );
}
