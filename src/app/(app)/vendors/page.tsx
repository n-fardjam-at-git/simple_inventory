import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { insertNamed } from "../catalog-actions";

export default async function VendorsPage() {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { data } = await supabase.from("vendors").select("id, name, notes").order("name");
  return (
    <div>
      <PageTitle title="Vendors" />
      <Card>
        <ul className="mb-4 space-y-1 text-sm">
          {(data ?? []).map((v) => (
            <li key={v.id}>
              <span className="font-medium">{v.name}</span>
              {v.notes ? <span className="text-stone-500"> — {v.notes}</span> : null}
            </li>
          ))}
        </ul>
        <form action={insertNamed.bind(null, "vendors")} className="flex flex-wrap gap-2 text-sm">
          <input name="name" required placeholder="Name" className="rounded border px-2 py-1" />
          <input name="notes" placeholder="Notes" className="rounded border px-2 py-1" />
          <Btn type="submit">Add</Btn>
        </form>
      </Card>
    </div>
  );
}
