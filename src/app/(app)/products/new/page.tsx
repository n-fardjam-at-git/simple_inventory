import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: lots } = await supabase.from("lots").select("id, lot_no");
  const { data: models } = await supabase
    .from("models")
    .select("id, name, size_chart_id, items ( name )");
  const { data: sizes } = await supabase
    .from("size_chart_sizes")
    .select("id, code, chart_id, sort_order")
    .order("sort_order");
  const { data: drops } = await supabase
    .from("size_chart_drops")
    .select("id, code, chart_id, sort_order")
    .order("sort_order");

  return (
    <div>
      <PageTitle title="New product" />
      <Card>
        <form action={createProduct} className="space-y-4 text-sm">
          <label className="block">
            Lot
            <select name="lot_id" required className="ml-2 rounded border px-2 py-1">
              {(lots ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lot_no}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Model
            <select name="model_id" required className="ml-2 rounded border px-2 py-1">
              {(models ?? []).map((m) => {
                const item = m.items as unknown as { name: string };
                return (
                  <option key={m.id} value={m.id}>
                    {item?.name} · {m.name}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block">
            Line price
            <input
              name="standard_price"
              type="number"
              step="0.01"
              defaultValue={0}
              className="ml-2 rounded border px-2 py-1"
            />
          </label>
          <p className="text-stone-500">
            Check sizes and drops from the model chart. Defaults: select all shown
            below (all charts listed; uncheck those not on this product). Prefer
            matching the chosen model’s chart.
          </p>
          <div>
            <p className="mb-1 font-medium">Sizes</p>
            <div className="flex flex-wrap gap-2">
              {(sizes ?? []).map((s) => (
                <label key={s.id}>
                  <input className="mr-1" type="checkbox" name="size_id" value={s.id} defaultChecked />
                  {s.code}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-medium">Drops</p>
            <div className="flex flex-wrap gap-2">
              {(drops ?? []).map((d) => (
                <label key={d.id}>
                  <input className="mr-1" type="checkbox" name="drop_id" value={d.id} defaultChecked />
                  {d.code}
                </label>
              ))}
            </div>
          </div>
          <Btn type="submit">Create</Btn>
        </form>
      </Card>
    </div>
  );
}
