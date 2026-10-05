import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card } from "@/components/ui";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("import_templates")
    .select("id, name, target, mappings")
    .order("name");
  return (
    <div>
      <PageTitle title="Excel import" />
      <Card>
        <ImportForm templates={data ?? []} />
      </Card>
    </div>
  );
}
