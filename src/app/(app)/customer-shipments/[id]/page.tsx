import { DismissNote } from "@/components/DismissNote";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { loadProductMatrix } from "@/lib/products";
import { QtyMatrix } from "@/components/matrix/QtyMatrix";
import { ComboBox } from "@/components/ComboBox";
import { AddForm } from "@/components/AddForm";
import { NumericInput } from "@/components/NumericInput";
import { PageTitle, Card, Btn } from "@/components/ui";
import {
  addShipmentProduct,
  saveShipmentCells,
  saveShipmentQty,
  setShipmentStatus,
} from "../actions";
import { isMerchandise, productTitle, productTypeLabel, PRODUCT_TYPE } from "@/lib/product-type";

export default async function CustomerShipmentDetail({
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
  const { data: shipment } = await supabase
    .from("customer_shipments")
    .select(
      "*, customers ( account_no, company_name, account_number ), customer_addresses ( location_name, address_line1, city, address_type )",
    )
    .eq("id", id)
    .single();
  const { data: lines } = await supabase
    .from("customer_shipment_products")
    .select("id, product_id, qty, products ( type, name )")
    .eq("customer_shipment_id", id);
  const { data: products } = await supabase
    .from("products")
    .select("id, type, name")
    .eq("is_active", true)
    .order("type")
    .order("name");
  const locked = shipment?.status !== "open";
  const customer = shipment?.customers as unknown as {
    company_name: string;
    account_no: number;
    account_number: string | null;
  };
  const addr = shipment?.customer_addresses as unknown as {
    location_name: string;
    address_line1: string;
    city: string;
    address_type: string;
  } | null;

  const sorted = [...(lines ?? [])].sort((a, b) => {
    const at = (a.products as unknown as { type: number })?.type ?? 1;
    const bt = (b.products as unknown as { type: number })?.type ?? 1;
    return at - bt;
  });

  return (
    <div className="space-y-6">
      <PageTitle title={`Shipment · ${customer?.company_name ?? ""}`} />
      {error ? (
        <DismissNote className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {decodeURIComponent(error)}
        </DismissNote>
      ) : null}
      <p className="text-sm text-stone-600">
        Account {customer?.account_no ?? "—"} · Sage {customer?.account_number ?? "—"} · {shipment?.shipping_date} ·{" "}
        {addr ? `${addr.location_name ?? addr.address_type}: ${addr.address_line1}, ${addr.city}` : "no ship-to"}{" "}
        · {shipment?.status}
      </p>
      {!locked ? (
        <form action={setShipmentStatus.bind(null, id)} className="flex gap-2 text-sm">
          <select name="status" className="rounded border px-2 py-1">
            <option value="shipped">shipped</option>
            <option value="cancelled">cancelled</option>
          </select>
          <Btn type="submit">Set status</Btn>
        </form>
      ) : (
        <p className="text-sm">Locked ({shipment?.status})</p>
      )}
      {!locked ? (
        <Card>
          <AddForm action={addShipmentProduct.bind(null, id)} className="flex gap-2 text-sm">
            <ComboBox
              name="product_id"
              required
              placeholder="Product"
              options={(products ?? []).map((p) => ({
                id: p.id,
                label: p.name ?? productTypeLabel(p.type),
              }))}
            />
            <Btn type="submit">Add product</Btn>
          </AddForm>
        </Card>
      ) : null}
      {await Promise.all(
        sorted.map(async (line) => {
          const type =
            (line.products as unknown as { type: number; name: string | null })?.type ?? 1;
          const m = await loadProductMatrix(line.product_id);
          const title = productTitle({
            type,
            name: (line.products as unknown as { name: string | null })?.name,
            lots: m.product?.lots as { lot_no: string } | null,
            models: m.product?.models as { name: string } | null,
          });

          if (!isMerchandise(type)) {
            const isFreight = type === PRODUCT_TYPE.freight;
            return (
              <Card key={line.id}>
                <h2 className="mb-2 font-medium">
                  {productTypeLabel(type)} · {title}
                  {isFreight ? " · qty 1" : null}
                </h2>
                {isFreight ? (
                  <p className="text-sm text-stone-600">
                    Total shipping cost (quantity is always 1) · $
                    {Number(m.product?.standard_price ?? 0).toFixed(2)}
                  </p>
                ) : locked ? (
                  <p className="text-sm">Qty {line.qty}</p>
                ) : (
                  <form action={saveShipmentQty.bind(null, id, line.id)} className="flex items-end gap-2 text-sm">
                    <label>
                      Qty
                      <NumericInput
                        name="qty"
                        inputMode="numeric"
                        defaultValue={line.qty || ""}
                        className="ml-2 w-20 rounded border px-2 py-1"
                      />
                    </label>
                    <Btn type="submit">Save qty</Btn>
                  </form>
                )}
              </Card>
            );
          }

          const { data: existing } = await supabase
            .from("customer_shipment_cells")
            .select("size_id, drop_id, qty")
            .eq("customer_shipment_product_id", line.id);
          const cells = m.cells.map((c) => {
            const hit = (existing ?? []).find(
              (e) => e.size_id === c.size_id && e.drop_id === c.drop_id,
            );
            return { ...c, qty: hit?.qty ?? 0 };
          });
          return (
            <Card key={line.id}>
              <h2 className="mb-2 font-medium">{title}</h2>
              {locked ? (
                <QtyMatrix sizes={m.sizes} drops={m.drops} cells={cells} />
              ) : (
                <form action={saveShipmentCells.bind(null, id, line.id)}>
                  <QtyMatrix
                    sizes={m.sizes}
                    drops={m.drops}
                    cells={cells}
                    editable
                    namePrefix="cell"
                  />
                  <div className="mt-2">
                    <Btn type="submit">Save qty</Btn>
                  </div>
                </form>
              )}
            </Card>
          );
        }),
      )}
    </div>
  );
}
