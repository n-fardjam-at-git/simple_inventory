import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Btn } from "@/components/ui";
import { addChart } from "./actions";
import { SizeChartsTable } from "./SizeChartsTable";
import { SizeListInput } from "./SizeListInput";
import { CasedInput } from "@/components/CasedInput";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";

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

  const rows = (charts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sizes: (sizes ?? [])
      .filter((s) => s.chart_id === c.id)
      .map((s) => s.code)
      .join(", "),
    drops: (drops ?? [])
      .filter((d) => d.chart_id === c.id && d.code.trim())
      .map((d) => d.code)
      .join(", "),
  }));

  return (
    <div>
      <PageTitle title="Size charts" />
      <p className="mb-4 text-sm text-stone-600">
        Enter sizes and drops as comma-separated lists. Order is the list position
        (first = smallest / first row). Example sizes: <code>36, 38, 40, 42</code>{" "}
        · drops: <code>S, R, L</code>. Leave drops blank if the chart has no length
        or drop — the matrix shows sizes only.
      </p>
      <FitPage>
      {rows.length === 0 ? (
        <p className="min-h-0 flex-1 text-sm text-stone-500">No size charts yet.</p>
      ) : (
        <SizeChartsTable rows={rows} />
      )}
      <AddForm action={addChart} className="flex shrink-0 flex-wrap items-end gap-2 text-sm">
        <CasedInput name="name" required aria-label="Chart name" placeholder="Chart name" className="rounded border px-2 py-1" />
        <SizeListInput
          name="sizes"
          placeholder="Sizes"
          className="w-[36rem] max-w-full rounded border px-2 py-1 font-mono"
        />
        <input name="drops" aria-label="Drops" placeholder="Drops" className="min-w-48 rounded border px-2 py-1 font-mono" />
        <Btn type="submit">Add</Btn>
      </AddForm>
      </FitPage>
    </div>
  );
}
