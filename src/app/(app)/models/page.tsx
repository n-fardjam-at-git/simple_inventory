import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Btn } from "@/components/ui";
import { addModel } from "../models-actions";
import { ModelsTable } from "./ModelsTable";
import { CasedInput } from "@/components/CasedInput";
import { ComboBox } from "@/components/ComboBox";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";

export default async function ModelsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: models } = await supabase
    .from("models")
    .select("id, name, is_active, item_id, size_chart_id, items ( name ), size_charts ( name )")
    .order("name");
  const { data: items } = await supabase
    .from("items")
    .select("id, name, default_size_chart_id")
    .eq("is_active", true);
  const { data: charts } = await supabase.from("size_charts").select("id, name");
  return (
    <div>
      <PageTitle title="Models" />
      <p className="mb-4 text-sm text-stone-600">
        A model belongs to an item and a size chart. It is not tied to a brand.
      </p>
      <FitPage>
          <ModelsTable
            rows={(models ?? []).map((m) => ({
              id: m.id,
              name: m.name,
              is_active: m.is_active,
              item_id: m.item_id,
              size_chart_id: m.size_chart_id,
              items: m.items as { name: string } | null,
              size_charts: m.size_charts as { name: string } | null,
            }))}
            items={(items ?? []).map((i) => ({ id: i.id, name: i.name }))}
            charts={charts ?? []}
          />
        <AddForm action={addModel} className="flex shrink-0 flex-wrap gap-2 text-sm">
          <CasedInput mode="brand" name="name" required aria-label="Model name" className="rounded border px-2 py-1" />
          <ComboBox
            name="item_id"
            required
            placeholder="Item"
            options={(items ?? []).map((i) => ({ id: i.id, label: i.name }))}
          />
          <ComboBox
            name="size_chart_id"
            required
            placeholder="Chart"
            options={(charts ?? []).map((c) => ({ id: c.id, label: c.name }))}
          />
          <Btn type="submit">Add</Btn>
        </AddForm>
      </FitPage>
    </div>
  );
}
