import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { saveCompany } from "./actions";

export default async function CompanyPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("company_profile")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();

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
    </div>
  );
}
