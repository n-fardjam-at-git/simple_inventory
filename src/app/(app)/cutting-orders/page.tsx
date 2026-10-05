import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { createCuttingOrder } from "./actions";

export default async function CuttingOrdersPage() {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("cutting_orders")
    .select("id, arrival_date, reference, status, vendors ( name )")
    .order("arrival_date", { ascending: false });
  const { data: vendors } = await supabase.from("vendors").select("id, name");
  const { data: products } = await supabase
    .from("products")
    .select("id, lots ( lot_no ), models ( name )");

  return (
    <div className="space-y-6">
      <PageTitle title="Cutting orders" />
      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-stone-500">
              <th className="py-1">Ref</th>
              <th>Vendor</th>
              <th>Arrival</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => {
              const v = o.vendors as unknown as { name: string };
              return (
                <tr key={o.id} className="border-t border-stone-100">
                  <td className="py-1">
                    <Link className="underline" href={`/cutting-orders/${o.id}`}>
                      {o.reference ?? o.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{v?.name}</td>
                  <td>{o.arrival_date}</td>
                  <td>{o.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card>
        <h2 className="mb-3 font-medium">New cutting order</h2>
        <form action={createCuttingOrder} className="space-y-3 text-sm">
          <label className="block">
            Vendor
            <select name="vendor_id" required className="ml-2 rounded border px-2 py-1">
              {(vendors ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Arrival date
            <input name="arrival_date" type="date" required className="ml-2 rounded border px-2 py-1" />
          </label>
          <label className="block">
            Reference
            <input name="reference" className="ml-2 rounded border px-2 py-1" />
          </label>
          <div>
            <p className="mb-1">Products on order (no quantities)</p>
            <div className="flex max-h-40 flex-col gap-1 overflow-auto">
              {(products ?? []).map((p) => {
                const lot = p.lots as unknown as { lot_no: string };
                const model = p.models as unknown as { name: string };
                return (
                  <label key={p.id}>
                    <input className="mr-1" type="checkbox" name="product_id" value={p.id} />
                    {lot?.lot_no} · {model?.name}
                  </label>
                );
              })}
            </div>
          </div>
          <Btn type="submit">Create</Btn>
        </form>
      </Card>
    </div>
  );
}
