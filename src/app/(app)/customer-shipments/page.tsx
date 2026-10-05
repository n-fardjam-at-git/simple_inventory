import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { createShipment } from "./actions";

export default async function CustomerShipmentsPage() {
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data: shipments } = await supabase
    .from("customer_shipments")
    .select("id, shipping_date, status, customers ( company_name, account_number )")
    .order("shipping_date", { ascending: false });
  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, account_number");
  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("id, customer_id, address_type, label, city")
    .in("address_type", ["shipping", "both"]);

  return (
    <div className="space-y-6">
      <PageTitle title="Customer shipments" />
      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-stone-500">
              <th className="py-1">Customer</th>
              <th>Sage</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(shipments ?? []).map((s) => {
              const c = s.customers as unknown as {
                company_name: string;
                account_number: string | null;
              };
              return (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="py-1">
                    <Link className="underline" href={`/customer-shipments/${s.id}`}>
                      {c?.company_name}
                    </Link>
                  </td>
                  <td>{c?.account_number ?? "—"}</td>
                  <td>{s.shipping_date}</td>
                  <td>{s.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">New shipment</h2>
        <form action={createShipment} className="flex flex-wrap gap-2 text-sm">
          <select name="customer_id" required className="rounded border px-2 py-1">
            {(customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name} {c.account_number ? `(${c.account_number})` : ""}
              </option>
            ))}
          </select>
          <select name="customer_address_id" className="rounded border px-2 py-1">
            <option value="">Ship-to (optional)</option>
            {(addresses ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.label ?? a.address_type} · {a.city}
              </option>
            ))}
          </select>
          <input name="shipping_date" type="date" required className="rounded border px-2 py-1" />
          <Btn type="submit">Create</Btn>
        </form>
        <p className="mt-2 text-xs text-stone-500">
          Only shipping / both addresses appear. Pick an address that belongs to the
          selected customer.
        </p>
      </Card>
    </div>
  );
}
