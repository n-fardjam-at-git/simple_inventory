import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { AddForm } from "@/components/AddForm";
import { updateCustomer, addAddress } from "../actions";
import { CasedInput } from "@/components/CasedInput";

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).single();
  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", id);

  return (
    <div className="space-y-6">
      <PageTitle title={customer?.company_name ?? "Customer"} />
      <Card>
        <form action={updateCustomer.bind(null, id)} className="flex flex-wrap gap-2 text-sm">
          <label>
            Name
            <CasedInput
              name="company_name"
              defaultValue={customer?.company_name}
              className="ml-1 rounded border px-2 py-1"
            />
          </label>
          <label>
            Sage account
            <input
              name="account_number"
              defaultValue={customer?.account_number ?? ""}
              className="ml-1 rounded border px-2 py-1"
            />
          </label>
          <Btn type="submit">Save</Btn>
        </form>
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Addresses</h2>
        <ul className="mb-4 text-sm">
          {(addresses ?? []).map((a) => (
            <li key={a.id}>
              [{a.address_type}] {a.label}: {a.address_line1}, {a.city}
            </li>
          ))}
        </ul>
        <AddForm action={addAddress.bind(null, id)} className="flex flex-wrap gap-2 text-sm">
          <select name="address_type" className="rounded border px-2 py-1">
            <option value="shipping">shipping</option>
            <option value="billing">billing</option>
            <option value="both">both</option>
          </select>
          <input name="label" aria-label="Label" className="rounded border px-2 py-1" />
          <input name="address_line1" aria-label="Street" className="rounded border px-2 py-1" />
          <input name="city" aria-label="City" className="rounded border px-2 py-1" />
          <input name="region" aria-label="Region" className="rounded border px-2 py-1" />
          <input name="postal_code" aria-label="Postal" className="rounded border px-2 py-1" />
          <input name="country" aria-label="Country" className="rounded border px-2 py-1" />
          <Btn type="submit">Add address</Btn>
        </AddForm>
      </Card>
    </div>
  );
}
