import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { addChart, addSize, addDrop } from "./actions";

export default async function SizeChartsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: charts } = await supabase.from("size_charts").select("id, name").order("name");
  const { data: sizes } = await supabase
    .from("size_chart_sizes")
    .select("id, chart_id, code, sort_order")
    .order("sort_order");
  const { data: drops } = await supabase
    .from("size_chart_drops")
    .select("id, chart_id, code, sort_order")
    .order("sort_order");

  return (
    <div>
      <PageTitle title="Size charts" />
      <Card>
        <form action={addChart} className="mb-6 flex gap-2 text-sm">
          <input name="name" required placeholder="US Jacket" className="rounded border px-2 py-1" />
          <Btn type="submit">Add chart</Btn>
        </form>
        {(charts ?? []).map((c) => (
          <div key={c.id} className="mb-6 border-t border-stone-100 pt-4">
            <h2 className="mb-2 font-medium">{c.name}</h2>
            <p className="text-xs text-stone-500">
              Sizes (columns, small → large):{" "}
              {(sizes ?? [])
                .filter((s) => s.chart_id === c.id)
                .map((s) => s.code)
                .join(", ")}
            </p>
            <p className="mb-2 text-xs text-stone-500">
              Drops (rows):{" "}
              {(drops ?? [])
                .filter((d) => d.chart_id === c.id)
                .map((d) => d.code)
                .join(", ")}
            </p>
            <form action={addSize} className="mb-2 flex gap-2 text-sm">
              <input type="hidden" name="chart_id" value={c.id} />
              <input name="code" placeholder="42" className="w-20 rounded border px-2 py-1" />
              <input name="sort_order" type="number" placeholder="order" className="w-20 rounded border px-2 py-1" />
              <Btn type="submit">Add size</Btn>
            </form>
            <form action={addDrop} className="flex gap-2 text-sm">
              <input type="hidden" name="chart_id" value={c.id} />
              <input name="code" placeholder="Regular" className="w-28 rounded border px-2 py-1" />
              <input name="sort_order" type="number" placeholder="order" className="w-20 rounded border px-2 py-1" />
              <Btn type="submit">Add drop</Btn>
            </form>
          </div>
        ))}
      </Card>
    </div>
  );
}
