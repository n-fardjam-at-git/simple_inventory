import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { FitPage } from "@/components/list/FitList";
import { CustomerOrdersTable, type CustomerOrderRow } from "./CustomerOrdersTable";
import { asSeasonRows } from "@/lib/season";
import { NewOrderForm } from "./NewOrderForm";

export default async function CustomerOrdersPage() {
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("customer_orders")
    .select("id, order_no, customer_id, status, start_date, customers ( account_no, company_name, account_number )")
    .order("order_no", { ascending: false });
  const { data: customers } = await supabase
    .from("customers")
    .select("id, account_no, company_name, account_number")
    .eq("is_active", true)
    .order("company_name");
  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("id, customer_id, address_type, location_name, city, address_line1");
  const { data: shipmentMethods } = await supabase
    .from("shipment_methods")
    .select("id, shipper, method")
    .eq("is_active", true)
    .order("sort_order");
  const { data: transmissionMethods } = await supabase
    .from("transmission_methods")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, year, start_season, is_combo, season");

  const rows: CustomerOrderRow[] = (orders ?? []).map((order) => {
    const customer = order.customers as unknown as {
      account_no: number;
      company_name: string;
      account_number: string | null;
    } | null;
    return {
      id: order.id,
      order_no: order.order_no,
      customer_id: order.customer_id,
      customer: customer?.company_name ?? "",
      account_no: customer?.account_no ?? null,
      account: customer?.account_number ?? "—",
      start_date: order.start_date,
      status: order.status,
    };
  });

  return (
    <div>
      <PageTitle title="Customer orders" />
      <FitPage>
        <NewOrderForm
          customers={customers ?? []}
          addresses={addresses ?? []}
          shipmentMethods={shipmentMethods ?? []}
          transmissionMethods={transmissionMethods ?? []}
          seasons={asSeasonRows(seasons ?? [])}
        />
        <CustomerOrdersTable rows={rows} customers={customers ?? []} />
      </FitPage>
    </div>
  );
}
