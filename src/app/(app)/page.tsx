import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageTitle, Card } from "@/components/ui";
import { cuttingOrderLabel } from "@/lib/cutting-order";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (profile?.role === "vendor") redirect("/vendor-advices");
  const supabase = await createClient();
  const { data: inventory } = await supabase
    .from("inventory")
    .select("qty_on_hand, reorder_point, product_id, products ( published )");
  const low = (inventory ?? []).filter(
    (i) => i.qty_on_hand <= i.reorder_point,
  ).length;
  const units = (inventory ?? []).reduce((s, i) => s + (i.qty_on_hand ?? 0), 0);
  const { data: orders } = await supabase
    .from("cutting_orders")
    .select("id, order_num, arrival_date, status, vendors ( name )")
    .eq("status", true)
    .order("arrival_date")
    .limit(8);

  return (
    <div>
      <PageTitle title="Dashboard" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-stone-500">Units on hand</p>
          <p className="text-2xl font-semibold">{units}</p>
          <Link className="text-xs text-stone-600 underline" href="/inventory">
            Open inventory
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Low-stock cells</p>
          <p className="text-2xl font-semibold">{low}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Open cutting orders</p>
          <p className="text-2xl font-semibold">{orders?.length ?? 0}</p>
        </Card>
      </div>
      <h2 className="mb-2 text-lg font-medium">Cutting orders by arrival</h2>
      <Card>
        <ul className="divide-y divide-stone-100">
          {(orders ?? []).map((o) => {
            const vendor = o.vendors as unknown as { name: string } | null;
            return (
              <li key={o.id} className="flex justify-between py-2 text-sm">
                <Link className="hover:underline" href={`/cutting-orders/${o.id}`}>
                  {cuttingOrderLabel(o.order_num)} · {vendor?.name}
                </Link>
                <span>{o.arrival_date}</span>
              </li>
            );
          })}
          {(orders ?? []).length === 0 ? (
            <li className="py-2 text-sm text-stone-500">None open</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
