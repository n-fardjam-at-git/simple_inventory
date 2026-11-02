import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { FitPage } from "@/components/list/FitList";
import { PaymentTermsTable, type PaymentTermRow } from "./PaymentTermsTable";
import { NewTermForm } from "./NewTermForm";

export default async function PaymentTermsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_terms")
    .select("id, term, description, days_due")
    .order("term");
  const rows: PaymentTermRow[] = (data ?? []).map((t) => ({
    id: t.id,
    term: t.term,
    description: t.description,
    days_due: t.days_due,
  }));

  return (
    <div>
      <PageTitle title="Terms" />
      <FitPage>
        <PaymentTermsTable rows={rows} />
        <NewTermForm />
      </FitPage>
    </div>
  );
}
