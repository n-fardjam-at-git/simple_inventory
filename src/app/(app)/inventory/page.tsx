import { requireUser } from "@/lib/auth";
import { loadInventoryBoards } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { asSeasonRows } from "@/lib/season";
import { InventoryWorkspace } from "./InventoryWorkspace";

export default async function InventoryPage() {
  const profile = await requireUser();
  const boards = await loadInventoryBoards();
  const canEdit = profile.role === "admin" || profile.role === "warehouse";
  const supabase = await createClient();
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, year, start_season, is_combo, season");
  const { data: collections } = await supabase.from("collections").select("id, name").order("name");
  const { data: brands } = await supabase.from("brands").select("id, name").order("name");
  const { data: items } = await supabase.from("items").select("id, name").order("name");
  const { data: models } = await supabase.from("models").select("id, name").order("name");
  const { data: colors } = await supabase.from("colors").select("id, name").order("name");
  const { data: patterns } = await supabase.from("patterns").select("id, name").order("name");
  const { data: contents } = await supabase.from("contents").select("id, name").order("name");

  return (
    <InventoryWorkspace
      boards={boards}
      canEdit={canEdit}
      seasons={asSeasonRows(seasons ?? [])}
      collections={collections ?? []}
      brands={brands ?? []}
      items={items ?? []}
      models={models ?? []}
      colors={colors ?? []}
      patterns={patterns ?? []}
      contents={contents ?? []}
    />
  );
}
