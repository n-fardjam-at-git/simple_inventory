import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { addModel } from "../models-actions";

export default async function ModelsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: models } = await supabase
    .from("models")
    .select("id, name, items ( name ), brands ( name ), size_charts ( name )")
    .order("name");
  const { data: items } = await supabase.from("items").select("id, name, default_size_chart_id");
  const { data: brands } = await supabase.from("brands").select("id, name");
  const { data: charts } = await supabase.from("size_charts").select("id, name");
  return (
    <div>
      <PageTitle title="Models" />
      <Card>
        <table className="mb-4 w-full text-left text-sm">
          <thead>
            <tr className="text-stone-500">
              <th className="py-1">Model</th>
              <th>Item</th>
              <th>Brand</th>
              <th>Chart</th>
            </tr>
          </thead>
          <tbody>
            {(models ?? []).map((m) => {
              const item = m.items as unknown as { name: string };
              const brand = m.brands as unknown as { name: string } | null;
              const chart = m.size_charts as unknown as { name: string };
              return (
                <tr key={m.id} className="border-t border-stone-100">
                  <td className="py-1">{m.name}</td>
                  <td>{item?.name}</td>
                  <td>{brand?.name}</td>
                  <td>{chart?.name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <form action={addModel} className="flex flex-wrap gap-2 text-sm">
          <input name="name" required placeholder="Model name" className="rounded border px-2 py-1" />
          <select name="item_id" required className="rounded border px-2 py-1">
            {(items ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <select name="brand_id" className="rounded border px-2 py-1">
            <option value="">Brand</option>
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select name="size_chart_id" required className="rounded border px-2 py-1">
            {(charts ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Btn type="submit">Add</Btn>
        </form>
      </Card>
    </div>
  );
}
