import { loadProductMatrix } from "@/lib/products";
import { QtyMatrix, UpchargeMatrix } from "@/components/matrix/QtyMatrix";
import { PageTitle, Card, Btn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  savePrices,
  applyUpchargeColumn,
  applyUpchargeRow,
  saveSubset,
  adjustCell,
} from "../actions";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireUser();
  const { product, sizes, drops, cells } = await loadProductMatrix(id);
  if (!product) return <p>Not found</p>;
  const lot = product.lots as unknown as {
    lot_no: string;
    brands: { name: string } | null;
  };
  const model = product.models as unknown as {
    name: string;
    items: { name: string };
    brands: { name: string } | null;
    size_chart_id: string;
  };
  const supabase = await createClient();
  const { data: chartSizes } = await supabase
    .from("size_chart_sizes")
    .select("id, code, sort_order")
    .eq("chart_id", product.size_chart_id)
    .order("sort_order");
  const { data: chartDrops } = await supabase
    .from("size_chart_drops")
    .select("id, code, sort_order")
    .eq("chart_id", product.size_chart_id)
    .order("sort_order");
  const selectedSizes = new Set(sizes.map((s) => s.id));
  const selectedDrops = new Set(drops.map((d) => d.id));
  const admin = profile.role === "admin";
  const warehouse = profile.role === "admin" || profile.role === "warehouse";

  return (
    <div className="space-y-6">
      <PageTitle title={`${lot?.lot_no} · ${model?.name}`} />
      <p className="text-sm text-stone-600">
        Brand {(lot?.brands?.name ?? model?.brands?.name) ?? "—"} · Item{" "}
        {model?.items?.name} · Lot {lot?.lot_no} · Line price $
        {Number(product.standard_price).toFixed(2)}
      </p>
      <Card>
        <h2 className="mb-3 font-medium">On hand</h2>
        <QtyMatrix sizes={sizes} drops={drops} cells={cells} />
      </Card>

      {admin ? (
        <Card>
          <h2 className="mb-3 font-medium">Line price and upcharges</h2>
          <form action={savePrices.bind(null, id)} className="space-y-3">
            <label className="block text-sm">
              Line price
              <input
                className="ml-2 rounded border border-stone-300 px-2 py-1"
                name="standard_price"
                type="number"
                step="0.01"
                defaultValue={Number(product.standard_price)}
              />
            </label>
            <UpchargeMatrix sizes={sizes} drops={drops} cells={cells} />
            <Btn type="submit">Save prices</Btn>
          </form>
          <div className="mt-4 flex flex-wrap gap-4">
            <form action={applyUpchargeColumn.bind(null, id)} className="flex items-end gap-2 text-sm">
              <label>
                Apply to size
                <select name="size_id" className="ml-1 rounded border px-1 py-1">
                  {sizes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </label>
              <input name="amount" type="number" step="0.01" className="w-20 rounded border px-1 py-1" defaultValue={10} />
              <Btn type="submit">Apply column</Btn>
            </form>
            <form action={applyUpchargeRow.bind(null, id)} className="flex items-end gap-2 text-sm">
              <label>
                Apply to drop
                <select name="drop_id" className="ml-1 rounded border px-1 py-1">
                  {drops.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code}
                    </option>
                  ))}
                </select>
              </label>
              <input name="amount" type="number" step="0.01" className="w-20 rounded border px-1 py-1" defaultValue={10} />
              <Btn type="submit">Apply row</Btn>
            </form>
          </div>
        </Card>
      ) : null}

      {admin ? (
        <Card>
          <h2 className="mb-3 font-medium">Size / drop subset (from item+model chart)</h2>
          <form action={saveSubset.bind(null, id)}>
            <p className="mb-1 text-xs text-stone-500">Sizes</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {(chartSizes ?? []).map((s) => (
                <label key={s.id} className="text-sm">
                  <input
                    className="mr-1"
                    type="checkbox"
                    name="size_id"
                    value={s.id}
                    defaultChecked={selectedSizes.has(s.id)}
                  />
                  {s.code}
                </label>
              ))}
            </div>
            <p className="mb-1 text-xs text-stone-500">Drops</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {(chartDrops ?? []).map((d) => (
                <label key={d.id} className="text-sm">
                  <input
                    className="mr-1"
                    type="checkbox"
                    name="drop_id"
                    value={d.id}
                    defaultChecked={selectedDrops.has(d.id)}
                  />
                  {d.code}
                </label>
              ))}
            </div>
            <Btn type="submit">Save subset</Btn>
          </form>
        </Card>
      ) : null}

      {warehouse ? (
        <Card>
          <h2 className="mb-3 font-medium">Adjust inventory</h2>
          <form action={adjustCell.bind(null, id)} className="flex flex-wrap items-end gap-2 text-sm">
            <select name="size_id" className="rounded border px-1 py-1">
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
            <select name="drop_id" className="rounded border px-1 py-1">
              {drops.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}
                </option>
              ))}
            </select>
            <input name="qty" type="number" defaultValue={1} className="w-20 rounded border px-1 py-1" />
            <input name="notes" placeholder="notes" className="rounded border px-1 py-1" />
            <Btn type="submit">Adjust</Btn>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
