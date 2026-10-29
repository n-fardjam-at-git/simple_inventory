import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { asSeasonRows } from "@/lib/season";
import { ProductsWorkspace } from "./ProductsWorkspace";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const profile = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, type, name, standard_price, price_stage, availability, published, is_active, collection_id, size_chart_id, collections ( name ), lots ( lot_no, brand_id, color_id, pattern_id, content_id, brands ( name ), colors ( name ), patterns ( name ), contents ( name ) ), models ( id, name, item_id, items ( name ) )",
    )
    .eq("type", 1)
    .order("name");
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, year, start_season, is_combo, season");
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, is_active")
    .order("name");
  const { data: brands } = await supabase.from("brands").select("id, name").order("name");
  const { data: items } = await supabase.from("items").select("id, name").order("name");
  const { data: models } = await supabase.from("models").select("id, name").order("name");
  const { data: colors } = await supabase.from("colors").select("id, name").order("name");
  const { data: patterns } = await supabase.from("patterns").select("id, name").order("name");
  const { data: contents } = await supabase.from("contents").select("id, name").order("name");

  const rows = (data ?? []).map((p) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    standard_price: Number(p.standard_price),
    price_stage: Number(p.price_stage ?? 1),
    availability: (p.availability as string | null) ?? null,
    is_active: p.is_active,
    collection_id: (p.collection_id as string | null) ?? null,
    size_chart_id: (p.size_chart_id as string | null) ?? null,
    collections: (() => {
      const c = Array.isArray(p.collections) ? p.collections[0] : p.collections;
      return (c as { name: string } | null) ?? null;
    })(),
    lots: (() => {
      const lot = Array.isArray(p.lots) ? p.lots[0] : p.lots;
      if (!lot) return null;
      const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { name: string } | null;
      return {
        lot_no: lot.lot_no as string,
        brand_id: (lot.brand_id as string | null) ?? null,
        color_id: (lot.color_id as string | null) ?? null,
        pattern_id: (lot.pattern_id as string | null) ?? null,
        content_id: (lot.content_id as string | null) ?? null,
        brands: one(lot.brands),
        colors: one(lot.colors),
        patterns: one(lot.patterns),
        contents: one(lot.contents),
      };
    })(),
    models: (() => {
      const model = Array.isArray(p.models) ? p.models[0] : p.models;
      if (!model) return null;
      const itemsRel = Array.isArray(model.items) ? model.items[0] : model.items;
      return {
        id: model.id as string,
        name: model.name as string,
        item_id: (model.item_id as string | null) ?? null,
        items: (itemsRel as { name: string } | null) ?? null,
      };
    })(),
  }));

  const { data: templateRows } = await supabase
    .from("product_templates")
    .select("id, name, brand_id, item_id, size_chart_id")
    .order("name");
  const { edit } = await searchParams;
  const canEdit = profile.role === "admin";

  return (
    <ProductsWorkspace
      rows={rows}
      canEdit={canEdit}
      seasons={asSeasonRows(seasons ?? [])}
      collections={collections ?? []}
      brands={brands ?? []}
      items={items ?? []}
      models={models ?? []}
      colors={colors ?? []}
      patterns={patterns ?? []}
      contents={contents ?? []}
      resumeId={edit || null}
      templates={templateRows ?? []}
    />
  );
}
