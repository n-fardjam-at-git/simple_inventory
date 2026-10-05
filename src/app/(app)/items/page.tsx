import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { insertNamed } from "../catalog-actions";

export default async function ItemsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select("id, name, default_size_chart_id, size_charts ( name )")
    .order("name");
  const { data: charts } = await supabase.from("size_charts").select("id, name");
  return (
    <div>
      <PageTitle title="Items" />
      <Card>
        <ul className="mb-4 text-sm">
          {(items ?? []).map((i) => {
            const chart = i.size_charts as unknown as { name: string } | null;
            return (
              <li key={i.id}>
                {i.name}{" "}
                <span className="text-stone-500">({chart?.name ?? "no default chart"})</span>
              </li>
            );
          })}
        </ul>
        <form action={insertNamed.bind(null, "items")} className="flex flex-wrap gap-2 text-sm">
          <input name="name" required placeholder="Jacket" className="rounded border px-2 py-1" />
          <select name="default_size_chart_id" className="rounded border px-2 py-1">
            <option value="">Default chart</option>
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
