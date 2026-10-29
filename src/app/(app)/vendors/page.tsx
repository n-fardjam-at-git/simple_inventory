import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Btn } from "@/components/ui";
import { insertNamed } from "../catalog-actions";
import { CasedInput } from "@/components/CasedInput";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";
import { VendorsTable, type VendorRow } from "./VendorsTable";

export default async function VendorsPage() {
  const profile = await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, name, notes, is_active")
    .order("name");
  const rows: VendorRow[] = (data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    notes: v.notes,
    is_active: Boolean(v.is_active),
  }));

  return (
    <div>
      <PageTitle title="Vendors" />
      <FitPage>
        {rows.length === 0 ? (
          <p className="min-h-0 flex-1 text-sm text-stone-500">No vendors yet.</p>
        ) : (
          <VendorsTable rows={rows} canEdit={profile.role === "admin"} />
        )}
        {profile.role === "admin" ? (
          <AddForm
            action={insertNamed.bind(null, "vendors")}
            className="flex shrink-0 flex-wrap gap-2 text-sm"
          >
            <CasedInput
              name="name"
              required
              aria-label="Vendor name"
              placeholder="Vendor name"
              className="rounded border px-2 py-1"
            />
            <CasedInput
              name="notes"
              aria-label="Notes"
              placeholder="Notes"
              className="rounded border px-2 py-1"
            />
            <Btn type="submit">Add</Btn>
          </AddForm>
        ) : null}
      </FitPage>
    </div>
  );
}
