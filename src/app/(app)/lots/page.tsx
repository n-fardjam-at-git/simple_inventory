import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { LotsWorkspace } from "./LotsWorkspace";
import { LookupCard } from "./LookupCard";

export default async function LotsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: lots } = await supabase
    .from("lots")
    .select(
      "id, lot_no, article, color_num, mill_article, is_active, color_id, pattern_id, content_id, brand_id, brands ( name )",
    );
  const { data: brands } = await supabase.from("brands").select("id, name").eq("is_active", true);
  const { data: colors } = await supabase.from("colors").select("id, name, is_active").order("name");
  const { data: patterns } = await supabase.from("patterns").select("id, name, is_active").order("name");
  const { data: contents } = await supabase.from("contents").select("id, name, is_active").order("name");

  const rows = (lots ?? [])
    .map((l) => ({
      ...l,
      brands: l.brands as { name: string } | null,
    }))
    .sort((a, b) => {
      const brand = (a.brands?.name ?? "").localeCompare(b.brands?.name ?? "", "en", {
        sensitivity: "base",
      });
      if (brand) return brand;
      const article = (a.article ?? "").localeCompare(b.article ?? "", "en", {
        sensitivity: "base",
      });
      if (article) return article;
      return String(a.color_num ?? "").localeCompare(String(b.color_num ?? ""), "en", {
        numeric: true,
        sensitivity: "base",
      });
    });

  return (
    <div className="space-y-6">
      <LotsWorkspace
        rows={rows}
        brands={brands ?? []}
        colors={colors ?? []}
        patterns={patterns ?? []}
        contents={contents ?? []}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <LookupCard title="Colors" table="colors" rows={colors ?? []} />
        <LookupCard title="Patterns" table="patterns" rows={patterns ?? []} />
        <LookupCard title="Contents" table="contents" rows={contents ?? []} asTyped />
      </div>
    </div>
  );
}
