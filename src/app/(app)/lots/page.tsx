import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { Card, Btn } from "@/components/ui";
import { insertNamed } from "../catalog-actions";
import { ActiveToggle } from "@/components/ActiveToggle";
import { CasedInput } from "@/components/CasedInput";
import { AddForm } from "@/components/AddForm";
import { LotsWorkspace } from "./LotsWorkspace";

function LookupCard({
  title,
  table,
  rows,
  asTyped = false,
}: {
  title: string;
  table: "colors" | "patterns" | "contents";
  rows: { id: string; name: string; is_active: boolean }[];
  asTyped?: boolean;
}) {
  return (
    <Card>
      <h2 className="mb-2 font-medium">{title}</h2>
      <ul className="mb-3 text-sm">
        {rows.map((r) => (
          <li key={r.id} className={r.is_active ? "" : "text-stone-400"}>
            {r.name}
            <span className="ml-2 inline-block">
              <ActiveToggle table={table} id={r.id} isActive={r.is_active} />
            </span>
          </li>
        ))}
      </ul>
      <AddForm action={insertNamed.bind(null, table)} className="flex gap-2 text-sm">
        {asTyped ? (
          <input name="name" required aria-label={title} className="rounded border px-2 py-1" />
        ) : (
          <CasedInput name="name" required aria-label={title} className="rounded border px-2 py-1" />
        )}
        <Btn type="submit">Add</Btn>
      </AddForm>
    </Card>
  );
}

export default async function LotsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: lots } = await supabase
    .from("lots")
    .select(
      "id, lot_no, article, color_num, is_active, color_id, pattern_id, content_id, brand_id, brands ( name )",
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
