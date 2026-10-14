import { requireRoles } from "@/lib/auth";
import { PageTitle, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { NewProductForm } from "../NewProductForm";
import { asSeasonRows } from "@/lib/season";

export default async function NewMerchandisePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRoles(["admin"]);
  const params = await searchParams;
  const errorText =
    params.error === "exists"
      ? "That lot and model already exist as a product. Open it from Products instead of creating it again."
      : params.error
        ? decodeURIComponent(params.error)
        : null;
  const supabase = await createClient();
  const { data: lots } = await supabase
    .from("lots")
    .select("id, lot_no")
    .eq("is_active", true);
  const { data: models } = await supabase
    .from("models")
    .select("id, name, size_chart_id, items ( name )")
    .eq("is_active", true);
  const { data: sizes } = await supabase
    .from("size_chart_sizes")
    .select("id, code, chart_id, sort_order")
    .order("sort_order");
  const { data: drops } = await supabase
    .from("size_chart_drops")
    .select("id, code, chart_id, sort_order")
    .order("sort_order");
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, year, start_season, is_combo, season");
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <PageTitle title="New merchandise" />
      {errorText ? (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorText}
        </p>
      ) : null}
      <Card>
        <NewProductForm
          kind="merchandise"
          lots={lots ?? []}
          models={(models ?? []) as { id: string; name: string; size_chart_id: string; items: unknown }[]}
          sizes={sizes ?? []}
          drops={drops ?? []}
          seasons={asSeasonRows(seasons ?? [])}
          collections={collections ?? []}
        />
      </Card>
    </div>
  );
}
