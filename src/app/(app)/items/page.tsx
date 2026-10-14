import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Btn } from "@/components/ui";
import { insertNamed } from "../catalog-actions";
import { ItemsTable } from "./ItemsTable";
import { CasedInput } from "@/components/CasedInput";
import { ComboBox } from "@/components/ComboBox";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";

export default async function ItemsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select("id, name, is_active, in_set, default_size_chart_id, size_charts ( name )")
    .order("name");
  const { data: charts } = await supabase.from("size_charts").select("id, name");
  const rows = (items ?? []).map((i) => {
    const chart = Array.isArray(i.size_charts) ? i.size_charts[0] : i.size_charts;
    return {
      id: i.id,
      name: i.name as string,
      is_active: Boolean(i.is_active),
      in_set: Boolean(i.in_set),
      default_size_chart_id: (i.default_size_chart_id as string | null) ?? null,
      size_charts: (chart as { name: string } | null) ?? null,
    };
  });

  return (
    <div>
      <PageTitle title="Items" />
      <FitPage>
        {rows.length === 0 ? (
          <p className="min-h-0 flex-1 text-sm text-stone-500">No items yet.</p>
        ) : (
          <ItemsTable rows={rows} charts={charts ?? []} />
        )}
        <AddForm action={insertNamed.bind(null, "items")} className="flex shrink-0 flex-wrap gap-2 text-sm">
          <CasedInput name="name" required aria-label="Item name" className="rounded border px-2 py-1" />
          <ComboBox
            name="default_size_chart_id"
            allowEmpty
            placeholder="Default chart"
            options={(charts ?? []).map((c) => ({ id: c.id, label: c.name }))}
          />
          <Btn type="submit">Add</Btn>
        </AddForm>
      </FitPage>
    </div>
  );
}
