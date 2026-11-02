import { DismissNote } from "@/components/DismissNote";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { loadProductMatrix } from "@/lib/products";
import { QtyMatrix, UpchargeMatrix, type Cell } from "@/components/matrix/QtyMatrix";
import { ComboBox } from "@/components/ComboBox";
import { AddForm } from "@/components/AddForm";
import { PriceInput } from "@/components/PriceInput";
import { PageTitle, Card, Btn } from "@/components/ui";
import {
  LINE_STATUS,
  SHIP_AT_ONCE,
  WORKFLOW_STATUS,
  commissionPercent,
  orderStatusLabel,
  shipmentMethodLabel,
} from "@/lib/customer-order";
import {
  addCustomerOrderProduct,
  removeCustomerOrderProduct,
  saveCustomerOrderLine,
  updateCustomerOrder,
} from "../actions";

export default async function CustomerOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("customer_orders")
    .select("*, customers ( account_no, company_name, account_number )")
    .eq("id", id)
    .single();
  if (!order) {
    return <PageTitle title="Order" />;
  }
  const { data: lines } = await supabase
    .from("customer_order_products")
    .select("product_id, price, commission_rate, status, products ( name )")
    .eq("customer_order_id", id);
  const { data: cellRows } = await supabase
    .from("customer_order_cells")
    .select("product_id, size_id, drop_id, qty, qty_shipped, price")
    .eq("customer_order_id", id);
  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("type", 1)
    .eq("is_active", true)
    .order("name");
  const { data: shipmentMethods } = await supabase
    .from("shipment_methods")
    .select("id, shipper, method, is_active")
    .order("sort_order");
  const { data: transmissionMethods } = await supabase
    .from("transmission_methods")
    .select("id, name, is_active")
    .order("sort_order");
  const { data: seasons } = await supabase
    .from("seasons")
    .select("season")
    .order("year", { ascending: false });

  const customer = order.customers as unknown as {
    account_no: number;
    company_name: string;
    account_number: string | null;
  } | null;
  const workflow = WORKFLOW_STATUS.includes(order.status);
  const onOrder = new Set((lines ?? []).map((line) => line.product_id));

  return (
    <div className="space-y-6">
      <PageTitle title={`Order ${order.order_no} · ${customer?.company_name ?? ""}`} />
      {error ? (
        <DismissNote className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {decodeURIComponent(error)}
        </DismissNote>
      ) : null}
      <p className="text-sm text-stone-600">
        Account {customer?.account_no ?? "—"} · Sage {customer?.account_number ?? "—"} · {orderStatusLabel(order.status)}
        {order.future_season ? ` · ${order.future_season}` : ""}
      </p>
      <Card>
        <form action={updateCustomerOrder.bind(null, id)} className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-3">
            <label>
              Start
              <input
                name="start_date"
                type="date"
                defaultValue={order.start_date ?? ""}
                className="ml-2 rounded border px-2 py-1"
              />
            </label>
            <label>
              Cancel
              <input
                name="cancel_date"
                type="date"
                title="Latest date the order can be delivered"
                defaultValue={order.cancel_date ?? ""}
                className="ml-2 rounded border px-2 py-1"
              />
            </label>
            <label>
              Season
              <select
                name="future_season"
                defaultValue={order.future_season ?? ""}
                className="ml-2 rounded border px-2 py-1"
              >
                <option value="">—</option>
                <option value={SHIP_AT_ONCE}>{SHIP_AT_ONCE}</option>
                {(seasons ?? []).map((s) => (
                  <option key={s.season} value={s.season}>
                    {s.season}
                  </option>
                ))}
              </select>
            </label>
            {workflow ? (
              <label>
                Status
                <select
                  name="status"
                  defaultValue={order.status}
                  className="ml-2 rounded border px-2 py-1"
                >
                  {WORKFLOW_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {orderStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="self-end text-stone-600">{orderStatusLabel(order.status)}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <label>
              Shipping method
              <ComboBox
                name="shipment_method_id"
                allowEmpty
                placeholder="Shipping method"
                aria-label="Shipping method"
                className="ml-2 min-w-56 rounded border px-2 py-1"
                defaultValue={order.shipment_method_id ?? ""}
                options={(shipmentMethods ?? [])
                  .filter((method) => method.is_active || method.id === order.shipment_method_id)
                  .map((method) => ({ id: method.id, label: shipmentMethodLabel(method) }))}
              />
            </label>
            <label>
              Terms
              <input
                name="terms"
                defaultValue={order.terms ?? ""}
                className="ml-2 rounded border px-2 py-1"
              />
            </label>
            <label>
              Received via
              <ComboBox
                name="transmission_method_id"
                allowEmpty
                placeholder="Received via"
                aria-label="Received via"
                className="ml-2 min-w-56 rounded border px-2 py-1"
                defaultValue={order.transmission_method_id ?? ""}
                options={(transmissionMethods ?? [])
                  .filter((method) => method.is_active || method.id === order.transmission_method_id)
                  .map((method) => ({ id: method.id, label: method.name }))}
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <AddressFields title="Ship to" prefix="ship" order={order} />
            <AddressFields title="Bill to" prefix="bill" order={order} />
          </div>
          <label className="block">
            Notes
            <textarea
              name="notes"
              defaultValue={order.notes ?? ""}
              rows={2}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <Btn type="submit">Save order</Btn>
        </form>
      </Card>
      <Card>
        <AddForm action={addCustomerOrderProduct.bind(null, id)} className="flex gap-2 text-sm">
          <ComboBox
            name="product_id"
            required
            placeholder="Product"
            options={(products ?? [])
              .filter((p) => !onOrder.has(p.id))
              .map((p) => ({ id: p.id, label: p.name ?? "Product" }))}
          />
          <Btn type="submit">Add product</Btn>
        </AddForm>
      </Card>
      {await Promise.all(
        (lines ?? []).map(async (line) => {
          const matrix = await loadProductMatrix(line.product_id);
          const stored = (cellRows ?? []).filter((c) => c.product_id === line.product_id);
          const cells: Cell[] = [];
          for (const size of matrix.sizes) {
            for (const drop of matrix.drops) {
              const hit = stored.find((c) => c.size_id === size.id && c.drop_id === drop.id);
              cells.push({
                size_id: size.id,
                drop_id: drop.id,
                qty: hit?.qty ?? 0,
                upcharge: hit?.price == null ? 0 : Number(hit.price),
              });
            }
          }
          const shipped = stored.reduce((sum, c) => sum + Number(c.qty_shipped ?? 0), 0);
          const ordered = stored.reduce((sum, c) => sum + Number(c.qty ?? 0), 0);
          const named = line.products as unknown as { name: string | null } | null;
          const title = named?.name?.trim() || "Product";
          return (
            <Card key={line.product_id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium">{title}</h2>
                <form action={removeCustomerOrderProduct.bind(null, id, line.product_id)}>
                  <Btn type="submit">Remove</Btn>
                </form>
              </div>
              <form
                action={saveCustomerOrderLine.bind(null, id, line.product_id)}
                className="space-y-3"
              >
                <div className="flex flex-wrap items-end gap-3 text-sm">
                  <label>
                    Price
                    <PriceInput
                      name="price"
                      defaultValue={Number(line.price).toFixed(2)}
                      className="ml-2 w-24 rounded border px-2 py-1"
                    />
                  </label>
                  <label>
                    Commission %
                    <input
                      name="commission"
                      inputMode="decimal"
                      defaultValue={commissionPercent(line.commission_rate)}
                      className="ml-2 w-20 rounded border px-2 py-1"
                    />
                  </label>
                  <label>
                    Line
                    <select
                      name="line_status"
                      defaultValue={line.status}
                      className="ml-2 rounded border px-2 py-1"
                    >
                      {LINE_STATUS.map((status) => (
                        <option key={status} value={status}>
                          {orderStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-stone-500">
                    Ordered {ordered}
                    {shipped ? ` · Shipped ${shipped}` : ""}
                  </p>
                </div>
                {matrix.sizes.length && matrix.drops.length ? (
                  <>
                    <QtyMatrix
                      sizes={matrix.sizes}
                      drops={matrix.drops}
                      cells={cells}
                      editable
                      showTotals
                      namePrefix="qty"
                    />
                    <div>
                      <p className="mb-1 text-xs text-teal-800">Size extra on this order</p>
                      <UpchargeMatrix sizes={matrix.sizes} drops={matrix.drops} cells={cells} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-stone-500">This product has no sizes yet.</p>
                )}
                <Btn type="submit">Save line</Btn>
              </form>
            </Card>
          );
        }),
      )}
    </div>
  );
}

function AddressFields({
  title,
  prefix,
  order,
}: {
  title: string;
  prefix: "ship" | "bill";
  order: Record<string, string | null>;
}) {
  const fields = [
    ["address_line1", "Street"],
    ["address_line2", "Street 2"],
    ["city", "City"],
    ["region", "State"],
    ["postal_code", "Postal"],
    ["country", "Country"],
  ] as const;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{title}</legend>
      {fields.map(([key, label]) => (
        <label key={key} className="block">
          <span className="mb-0.5 block text-xs text-stone-500">{label}</span>
          <input
            name={`${prefix}_${key}`}
            defaultValue={order[`${prefix}_${key}`] ?? ""}
            className="w-full rounded border px-2 py-1"
          />
        </label>
      ))}
    </fieldset>
  );
}
