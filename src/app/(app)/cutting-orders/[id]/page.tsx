import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { cuttingOrderLabel } from "@/lib/cutting-order";
import { setOrderStatus, setProductStatus } from "../actions";

export default async function CuttingOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("cutting_orders")
    .select("*, vendors ( name ), brands ( name )")
    .eq("id", id)
    .single();
  const { data: lines } = await supabase
    .from("cutting_order_products")
    .select("product_id, status, products ( name )")
    .eq("cutting_order_id", id);

  return (
    <div className="space-y-4">
      <PageTitle title={cuttingOrderLabel(order?.order_num as number | undefined)} />
      <p className="text-sm text-stone-600">
        Vendor {(order?.vendors as { name: string } | null)?.name} · Brand{" "}
        {(order?.brands as { name: string } | null)?.name} · Arrival{" "}
        {order?.arrival_date} · Submitted {order?.date_submitted ?? "—"} · {order?.status ? "Open" : "Closed"}
      </p>
      <form action={setOrderStatus.bind(null, id)} className="flex gap-2 text-sm">
        <select
          name="status"
          defaultValue={order?.status ? "true" : "false"}
          className="rounded border px-2 py-1"
        >
          <option value="true">Open</option>
          <option value="false">Closed</option>
        </select>
        <Btn type="submit">Update order status</Btn>
      </form>
      <Card>
        <h2 className="mb-2 font-medium">Products</h2>
        <ul className="space-y-2 text-sm">
          {(lines ?? []).map((l) => {
            const p = l.products as unknown as { name: string };
            return (
              <li key={l.product_id} className="flex items-center justify-between gap-2">
                <span>
                  {p?.name} — {l.status ? "Open" : "Complete"}
                </span>
                <form action={setProductStatus.bind(null, id)} className="flex gap-1">
                  <input type="hidden" name="product_id" value={l.product_id} />
                  <select
                    name="status"
                    defaultValue={l.status ? "true" : "false"}
                    className="rounded border px-1"
                  >
                    <option value="true">Open</option>
                    <option value="false">Complete</option>
                  </select>
                  <Btn type="submit">Save</Btn>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>
      <Link className="inline-block rounded bg-stone-900 px-3 py-1.5 text-sm text-white" href={`/cutting-orders/${id}/receive`}>
        Receive cutting shipment
      </Link>
    </div>
  );
}
