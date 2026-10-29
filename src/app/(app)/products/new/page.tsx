import { DismissNote } from "@/components/DismissNote";
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
    .select("id, lot_no, brand_id")
    .eq("is_active", true);
  const { data: models } = await supabase
    .from("models")
    .select("id, name, size_chart_id, item_id, items ( name )")
    .eq("is_active", true);
  const { data: templateRows } = await supabase
    .from("product_templates")
    .select(
      "id, name, brand_id, item_id, size_chart_id, standard_price, size_charts ( name ), product_template_sizes ( size_id ), product_template_drops ( drop_id ), product_template_upcharges ( size_id, drop_id, upcharge_amount )",
    )
    .order("name");
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
        <DismissNote className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorText}
        </DismissNote>
      ) : null}
      <Card>
        <NewProductForm
          kind="merchandise"
          lots={lots ?? []}
          models={(models ?? []) as {
            id: string;
            name: string;
            size_chart_id: string;
            item_id: string;
            items: unknown;
          }[]}
          sizes={sizes ?? []}
          drops={drops ?? []}
          seasons={asSeasonRows(seasons ?? [])}
          collections={collections ?? []}
          templates={(templateRows ?? []).map((t) => {
            const chart = Array.isArray(t.size_charts) ? t.size_charts[0] : t.size_charts;
            return {
              id: t.id,
              name: t.name,
              brand_id: t.brand_id,
              item_id: t.item_id,
              size_chart_id: t.size_chart_id,
              chart_name: (chart as { name?: string } | null)?.name ?? "",
              standard_price: Number(t.standard_price),
              size_ids: (t.product_template_sizes ?? []).map((s: { size_id: string }) => s.size_id),
              drop_ids: (t.product_template_drops ?? []).map((d: { drop_id: string }) => d.drop_id),
              upcharges: (t.product_template_upcharges ?? []).map(
                (u: { size_id: string; drop_id: string; upcharge_amount: number }) => ({
                  size_id: u.size_id,
                  drop_id: u.drop_id,
                  amount: Number(u.upcharge_amount),
                }),
              ),
            };
          })}
        />
      </Card>
    </div>
  );
}
