import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { shipmentStatusLabel } from "@/lib/customer-shipment";
import { PageTitle, Card } from "@/components/ui";
import { NewShipmentForm } from "./NewShipmentForm";

function one<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export default async function CustomerShipmentsPage() {
  const profile = await requireRoles(["admin", "warehouse", "sales_rep"]);
  const canWrite = profile.role === "admin" || profile.role === "warehouse";
  const supabase = await createClient();
  const { data: shipments } = await supabase
    .from("customer_shipments")
    .select("id, shipment_no, status, created_at, date_shipped, customers ( company_name )")
    .order("shipment_no", { ascending: false });
  const ids = (shipments ?? []).map((shipment) => shipment.id);
  const { data: lines } = ids.length
    ? await supabase
        .from("customer_shipment_products")
        .select("customer_shipment_id, customer_orders ( order_no )")
        .in("customer_shipment_id", ids)
        .not("customer_order_id", "is", null)
    : { data: [] };
  const { data: customers } = canWrite
    ? await supabase
        .from("customers")
        .select("id, account_no, company_name, account_number")
        .eq("is_active", true)
        .order("company_name")
    : { data: [] };

  const ordersByShipment = new Map<string, Set<number>>();
  for (const line of lines ?? []) {
    const orderNo = one<{ order_no: number }>(line.customer_orders)?.order_no;
    if (orderNo == null) continue;
    const set = ordersByShipment.get(line.customer_shipment_id) ?? new Set<number>();
    set.add(orderNo);
    ordersByShipment.set(line.customer_shipment_id, set);
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Customer shipments" />
      {canWrite ? (
        <Card>
          <h2 className="mb-2 font-medium">New shipment</h2>
          <NewShipmentForm customers={customers ?? []} />
          <p className="mt-2 text-xs text-stone-500">
            Pick the customer, then add that customer&apos;s approved orders on the shipment.
          </p>
        </Card>
      ) : null}
      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-stone-500">
              <th className="py-1">Shipment</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Orders</th>
              <th>Status</th>
              <th>Shipped</th>
            </tr>
          </thead>
          <tbody>
            {(shipments ?? []).map((shipment) => {
              const customer = one<{ company_name: string }>(shipment.customers);
              const orders = [...(ordersByShipment.get(shipment.id) ?? [])].sort((a, b) => a - b);
              return (
                <tr key={shipment.id} className="border-t border-stone-100">
                  <td className="py-1 tabular-nums">
                    <Link className="underline" href={`/customer-shipments/${shipment.id}`}>
                      {shipment.shipment_no}
                    </Link>
                  </td>
                  <td className="tabular-nums">{String(shipment.created_at).slice(0, 10)}</td>
                  <td>{customer?.company_name ?? "—"}</td>
                  <td className="tabular-nums">{orders.length ? orders.join(", ") : "—"}</td>
                  <td>{shipmentStatusLabel(shipment.status)}</td>
                  <td className="tabular-nums">{shipment.date_shipped ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(shipments ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No shipments yet.</p>
        ) : null}
      </Card>
    </div>
  );
}
