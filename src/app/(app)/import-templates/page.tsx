import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card } from "@/components/ui";
import { TemplateEditor } from "./TemplateEditor";

export default async function ImportTemplatesPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("import_templates")
    .select("id, name, target, mappings")
    .order("name");
  return (
    <div>
      <PageTitle title="Import templates" />
      <Card>
        <p className="mb-4 text-sm text-stone-600">
          Map Excel column headers to destination fields. Mark link fields (usually Sage
          account number) used to match existing customers.
        </p>
        <TemplateEditor templates={data ?? []} />
      </Card>
    </div>
  );
}
