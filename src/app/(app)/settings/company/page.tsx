import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { saveCompany, addContact } from "./actions";
import { AddForm } from "@/components/AddForm";

export default async function CompanyPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("company_profile")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();
  const { data: contacts } = await supabase
    .from("company_contacts")
    .select("*")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <PageTitle title="Gruppo Bravo particulars" />
      <Card>
        <form action={saveCompany} className="grid gap-3 text-sm sm:grid-cols-2">
          {(
            [
              ["legal_name", "Legal name"],
              ["trade_name", "Trade name"],
              ["address_line1", "Address"],
              ["address_line2", "Address 2"],
              ["city", "City"],
              ["region", "Region"],
              ["postal_code", "Postal"],
              ["country", "Country"],
              ["tax_id", "Tax ID"],
              ["notes", "Notes"],
            ] as const
          ).map(([name, label]) => (
            <label key={name} className="block">
              {label}
              <input
                name={name}
                className="mt-1 w-full rounded border px-2 py-1"
                defaultValue={(company?.[name] as string) ?? ""}
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            <Btn type="submit">Save</Btn>
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="mb-3 font-medium">Contacts</h2>
        <ul className="mb-4 text-sm">
          {(contacts ?? []).map((c) => (
            <li key={c.id}>
              {c.kind} · {c.label}: {c.value}
              {c.is_primary ? " (primary)" : ""}
            </li>
          ))}
        </ul>
        <AddForm action={addContact} className="flex flex-wrap gap-2 text-sm">
          <select name="kind" className="rounded border px-2 py-1">
            <option value="email">email</option>
            <option value="phone">phone</option>
            <option value="fax">fax</option>
            <option value="website">website</option>
          </select>
          <input name="label" aria-label="Contact label" className="rounded border px-2 py-1" />
          <input name="value" required aria-label="Contact value" className="rounded border px-2 py-1" />
          <label className="flex items-center gap-1">
            <input type="checkbox" name="is_primary" /> primary
          </label>
          <Btn type="submit">Add</Btn>
        </AddForm>
      </Card>
    </div>
  );
}
