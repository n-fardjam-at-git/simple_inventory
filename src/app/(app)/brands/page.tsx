import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { insertNamed } from "../catalog-actions";

export default async function BrandsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("id, name").order("name");
  return (
    <div>
      <PageTitle title="Brands" />
      <Card>
        <ul className="mb-4 list-disc pl-5 text-sm">
          {(data ?? []).map((b) => (
            <li key={b.id}>{b.name}</li>
          ))}
        </ul>
        <form action={insertNamed.bind(null, "brands")} className="flex gap-2 text-sm">
          <input name="name" required placeholder="Name" className="rounded border px-2 py-1" />
          <Btn type="submit">Add</Btn>
        </form>
      </Card>
    </div>
  );
}
