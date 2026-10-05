import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { loadProductMatrix } from "@/lib/products";
import { QtyMatrix } from "@/components/matrix/QtyMatrix";
import { PageTitle, Card, Btn } from "@/components/ui";
import {
  addShipmentProduct,
  saveShipmentCells,
  setShipmentStatus,
} from "../actions";

export default async function CustomerShipmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data: shipment } = await supabase
    .from("customer_shipments")
    .select(
      "*, customers ( company_name, account_number ), customer_addresses ( label, address_line1, city, address_type )",
    )
    .eq("id", id)
    .single();
  const { data: lines } = await supabase
    .from("customer_shipment_products")
    .select("id, product_id")
    .eq("customer_shipment_id", id);
  const { data: products } = await supabase
    .from("products")
    .select("id, lots ( lot_no ), models ( name )");
  const locked = shipment?.status !== "open";
  const customer = shipment?.customers as unknown as {
    company_name: string;
    account_number: string | null;
  };
  const addr = shipment?.customer_addresses as unknown as {
    label: string;
    address_line1: string;
    city: string;
    address_type: string;
  } | null;

  return (
    <div className="space-y-6">
      <PageTitle title={`Shipment · ${customer?.company_name ?? ""}`} />
      <p className="text-sm text-stone-600">
        Sage {customer?.account_number ?? "—"} · {shipment?.shipping_date} ·{" "}
        {addr ? `${addr.label ?? addr.address_type}: ${addr.address_line1}, ${addr.city}` : "no ship-to"}{" "}
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
          <form action={addShipmentProduct.bind(null, id)} className="flex gap-2 text-sm">
            <select name="product_id" className="rounded border px-2 py-1">
              {(products ?? []).map((p) => {
                const lot = p.lots as unknown as { lot_no: string };
                const model = p.models as unknown as { name: string };
                return (
                  <option key={p.id} value={p.id}>
                    {lot?.lot_no} · {model?.name}
                  </option>
                );
              })}
            </select>
            <Btn type="submit">Add product</Btn>
          </form>
        </Card>
      ) : null}
      {await Promise.all(
        (lines ?? []).map(async (line) => {
          const m = await loadProductMatrix(line.product_id);
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
          const lot = m.product?.lots as unknown as { lot_no: string };
          const model = m.product?.models as unknown as { name: string };
          return (
            <Card key={line.id}>
              <h2 className="mb-2 font-medium">
                {lot?.lot_no} · {model?.name}
              </h2>
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
