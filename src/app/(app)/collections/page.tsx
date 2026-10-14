import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { insertNamed } from "../catalog-actions";
import { ActiveToggle } from "@/components/ActiveToggle";
import { CasedInput } from "@/components/CasedInput";
import { AddForm } from "@/components/AddForm";

export default async function CollectionsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("collections").select("id, name, is_active").order("name");
  return (
    <div>
      <PageTitle title="Collections" />
      <Card>
        <ul className="mb-4 list-disc pl-5 text-sm">
          {(data ?? []).map((c) => (
            <li key={c.id} className={c.is_active ? "" : "text-stone-400"}>
              {c.name} {c.is_active ? "" : "(inactive)"}
              <span className="ml-2 inline-block">
                <ActiveToggle table="collections" id={c.id} isActive={c.is_active} />
              </span>
            </li>
          ))}
        </ul>
        <AddForm action={insertNamed.bind(null, "collections")} className="flex gap-2 text-sm">
          <CasedInput name="name" required aria-label="Collection name" className="rounded border px-2 py-1" />
          <Btn type="submit">Add</Btn>
        </AddForm>
      </Card>
    </div>
  );
}
