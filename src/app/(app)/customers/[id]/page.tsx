import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { AddForm } from "@/components/AddForm";
import { updateCustomer, addAddress } from "../actions";
import { CasedInput } from "@/components/CasedInput";
import { US_REGIONS } from "@/lib/regions";

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
  const { data: terms } = await supabase.from("payment_terms").select("id, term").order("term");

  return (
    <div className="space-y-6">
      <PageTitle title={customer?.company_name ?? "Customer"} />
      {customer?.do_not_ship ? (
        <p className="text-sm font-medium text-red-700">Do not ship</p>
      ) : null}
      <Card>
        <form action={updateCustomer.bind(null, id)} className="flex flex-wrap items-end gap-2 text-sm">
          <label>
            Name
            <CasedInput
              name="company_name"
              defaultValue={customer?.company_name}
              className="ml-1 rounded border px-2 py-1"
            />
          </label>
          <label>
            Business name
            <CasedInput
              name="business_name"
              defaultValue={customer?.business_name ?? ""}
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
          <label>
            Contact
            <CasedInput
              name="contact"
              defaultValue={customer?.contact ?? ""}
              className="ml-1 rounded border px-2 py-1"
            />
          </label>
          <label>
            Email
            <input
              name="email"
              defaultValue={customer?.email ?? ""}
              className="ml-1 rounded border px-2 py-1"
            />
          </label>
          <label>
            Phone
            <input
              name="phone"
              defaultValue={customer?.phone ?? ""}
              className="ml-1 rounded border px-2 py-1"
            />
          </label>
          <label>
            Cell phone
            <input
              name="cell_phone"
              defaultValue={customer?.cell_phone ?? ""}
              className="ml-1 rounded border px-2 py-1"
            />
          </label>
          <label>
            Terms
            <select
              name="payment_term_id"
              defaultValue={customer?.payment_term_id ?? ""}
              className="ml-1 rounded border px-2 py-1"
            >
              <option value="">None</option>
              {(terms ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.term}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notes
            <CasedInput
              name="notes"
              defaultValue={customer?.notes ?? ""}
              className="ml-1 rounded border px-2 py-1"
            />
          </label>
          <label className="pb-1">
            <input
              type="checkbox"
              name="do_not_ship"
              defaultChecked={Boolean(customer?.do_not_ship)}
              className="mr-1"
            />
            Do not ship
          </label>
          <Btn type="submit">Save</Btn>
        </form>
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">Addresses</h2>
        <ul className="mb-4 text-sm">
          {(addresses ?? []).map((a) => (
            <li key={a.id}>
              [{a.address_type}] {a.location_name}: {a.address_line1}, {a.city}
            </li>
          ))}
        </ul>
        <AddForm action={addAddress.bind(null, id)} className="flex flex-wrap gap-2 text-sm">
          <select name="address_type" className="rounded border px-2 py-1">
            <option value="shipping">shipping</option>
            <option value="billing">billing</option>
            <option value="both">both</option>
          </select>
          <input
            name="location_name"
            aria-label="Location name"
            placeholder="Location name"
            defaultValue={customer?.company_name ?? ""}
            className="rounded border px-2 py-1"
          />
          <input name="address_line1" aria-label="Street" className="rounded border px-2 py-1" />
          <input name="city" aria-label="City" className="rounded border px-2 py-1" />
          <select name="region" aria-label="Region" className="rounded border px-2 py-1" defaultValue="">
            <option value=""></option>
            {US_REGIONS.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
          <input name="postal_code" aria-label="Postal" className="rounded border px-2 py-1" />
          <input name="country" aria-label="Country" defaultValue="USA" className="rounded border px-2 py-1" />
          <Btn type="submit">Add address</Btn>
        </AddForm>
      </Card>
    </div>
  );
}
