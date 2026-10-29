import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { FitPage } from "@/components/list/FitList";
import { UsersTable, type UserRow } from "./UsersTable";

function rel<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

export default async function UsersPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, display_name, role, vendor_id, customer_id, vendors ( name ), customers!profiles_customer_id_fkey ( company_name )",
    )
    .order("display_name");
  const { data: vendors } = await supabase.from("vendors").select("id, name").order("name");
  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name")
    .order("company_name");

  const rows: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    vendor_id: p.vendor_id,
    customer_id: p.customer_id,
    vendor_name: rel<{ name: string }>(p.vendors)?.name ?? null,
    customer_name: rel<{ company_name: string }>(p.customers)?.company_name ?? null,
  }));

  return (
    <div>
      <PageTitle title="Users" />
      <FitPage>
        <UsersTable
          rows={rows}
          vendors={(vendors ?? []).map((v) => ({ id: v.id, name: v.name }))}
          customers={(customers ?? []).map((c) => ({
            id: c.id,
            name: c.company_name,
          }))}
        />
      </FitPage>
    </div>
  );
}
