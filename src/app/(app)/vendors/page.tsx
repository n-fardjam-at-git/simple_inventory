import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { insertNamed } from "../catalog-actions";
import { ActiveToggle } from "@/components/ActiveToggle";
import { CasedInput } from "@/components/CasedInput";
import { AddForm } from "@/components/AddForm";

export default async function VendorsPage() {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { data } = await supabase.from("vendors").select("id, name, notes, is_active").order("name");
  return (
    <div>
      <PageTitle title="Vendors" />
      <Card>
        <ul className="mb-4 space-y-1 text-sm">
          {(data ?? []).map((v) => (
            <li key={v.id} className={v.is_active ? "" : "text-stone-400"}>
              <span className="font-medium">{v.name}</span>
              {v.notes ? <span className="text-stone-500"> — {v.notes}</span> : null}
              <span className="ml-2 inline-block">
                <ActiveToggle table="vendors" id={v.id} isActive={v.is_active} />
              </span>
            </li>
          ))}
        </ul>
        <AddForm action={insertNamed.bind(null, "vendors")} className="flex flex-wrap gap-2 text-sm">
          <CasedInput name="name" required aria-label="Vendor name" className="rounded border px-2 py-1" />
          <CasedInput name="notes" aria-label="Notes" className="rounded border px-2 py-1" />
          <Btn type="submit">Add</Btn>
        </AddForm>
      </Card>
    </div>
  );
}
