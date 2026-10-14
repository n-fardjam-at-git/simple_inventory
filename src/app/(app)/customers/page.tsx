import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { createCustomer } from "./actions";
import { ActiveToggle } from "@/components/ActiveToggle";
import { CasedInput } from "@/components/CasedInput";
import { AddForm } from "@/components/AddForm";

export default async function CustomersPage() {
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, company_name, account_number, is_active")
    .order("company_name");

  return (
    <div className="space-y-6">
      <PageTitle title="Customers" />
      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-stone-500">
              <th className="py-1">Name</th>
              <th>Sage account</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className={`border-t border-stone-100 ${c.is_active ? "" : "text-stone-400"}`}>
                <td className="py-1">
                  <Link className="underline" href={`/customers/${c.id}`}>
                    {c.company_name}
                  </Link>
                </td>
                <td>{c.account_number ?? "—"}</td>
                <td>
                  {c.is_active ? "Active" : "Inactive"}
                  <ActiveToggle table="customers" id={c.id} isActive={c.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">New customer</h2>
        <AddForm action={createCustomer} className="flex flex-wrap gap-2 text-sm">
          <CasedInput name="company_name" required aria-label="Company" className="rounded border px-2 py-1" />
          <input name="account_number" aria-label="Sage account" className="rounded border px-2 py-1" />
          <Btn type="submit">Add</Btn>
        </AddForm>
      </Card>
    </div>
  );
}
