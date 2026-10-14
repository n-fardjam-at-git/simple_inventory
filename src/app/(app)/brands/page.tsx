import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { insertNamed } from "../catalog-actions";
import { ActiveToggle } from "@/components/ActiveToggle";
import { CasedInput } from "@/components/CasedInput";
import { AddForm } from "@/components/AddForm";

export default async function BrandsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("id, name, is_active").order("name");
  return (
    <div>
      <PageTitle title="Brands" />
      <Card>
        <ul className="mb-4 list-disc pl-5 text-sm">
          {(data ?? []).map((b) => (
            <li key={b.id} className={b.is_active ? "" : "text-stone-400"}>
              {b.name} {b.is_active ? "" : "(inactive)"}
              <span className="ml-2 inline-block">
                <ActiveToggle table="brands" id={b.id} isActive={b.is_active} />
              </span>
            </li>
          ))}
        </ul>
        <AddForm action={insertNamed.bind(null, "brands")} className="flex gap-2 text-sm">
          <CasedInput mode="brand" name="name" required aria-label="Brand name" className="rounded border px-2 py-1" />
          <Btn type="submit">Add</Btn>
        </AddForm>
      </Card>
    </div>
  );
}
