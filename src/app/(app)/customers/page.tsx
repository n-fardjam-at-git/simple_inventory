import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { CustomersWorkspace } from "./CustomersWorkspace";
import type { CustomerRow, SalesRepOption, TermOption } from "./CustomersTable";
import type { CustomerAddress } from "./CustomerDetailsPanel";

function termParts(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return { term: "", days_due: null as number | null };
  const term = "term" in row ? String(row.term ?? "") : "";
  const raw = "days_due" in row ? row.days_due : null;
  const days_due = raw == null || raw === "" ? null : Number(raw);
  return { term, days_due: Number.isFinite(days_due) ? days_due : null };
}

export default async function CustomersPage() {
  const profile = await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select(
      "id, account_no, company_name, business_name, account_number, contact, email, phone, cell_phone, payment_term_id, sales_rep_id, do_not_ship, notes, is_active, payment_terms ( term, days_due )",
    )
    .order("company_name");
  const { data: terms } = await supabase.from("payment_terms").select("id, term").order("term");
  const { data: repRows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("role", "sales_rep")
    .order("display_name");
  const { data: addressRows } = await supabase
    .from("customer_addresses")
    .select(
      "id, customer_id, address_type, location_name, address_line1, address_line2, city, region, postal_code, country",
    );

  const reps: SalesRepOption[] = (repRows ?? []).map((rep) => ({
    id: rep.id,
    name: rep.display_name.trim() || "Sales rep",
  }));
  const repName = new Map(reps.map((rep) => [rep.id, rep.name]));
  const rows: CustomerRow[] = (data ?? []).map((c) => {
    const term = termParts(c.payment_terms);
    return {
      id: c.id,
      account_no: c.account_no,
      company_name: c.company_name,
      business_name: c.business_name,
      account_number: c.account_number,
      contact: c.contact,
      email: c.email,
      phone: c.phone,
      cell_phone: c.cell_phone,
      payment_term_id: c.payment_term_id,
      sales_rep_id: c.sales_rep_id,
      sales_rep_name: (c.sales_rep_id && repName.get(c.sales_rep_id)) || "",
      term: term.term,
      days_due: term.days_due,
      do_not_ship: Boolean(c.do_not_ship),
      notes: c.notes,
      is_active: Boolean(c.is_active),
    };
  });
  const addresses: CustomerAddress[] = (addressRows ?? []).map((address) => ({
    id: address.id,
    customer_id: address.customer_id,
    address_type: address.address_type,
    location_name: address.location_name,
    address_line1: address.address_line1,
    address_line2: address.address_line2,
    city: address.city,
    region: address.region,
    postal_code: address.postal_code,
    country: address.country,
  }));
  const termOptions: TermOption[] = (terms ?? []).map((t) => ({ id: t.id, term: t.term }));

  return (
    <CustomersWorkspace
      rows={rows}
      terms={termOptions}
      reps={reps}
      addresses={addresses}
      canEdit={profile.role === "admin"}
    />
  );
}
