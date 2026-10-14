"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NO_DROP_CODE, normalizeSizeList } from "@/lib/size-code";
import { toSentenceCase } from "@/lib/text-case";

function parseList(raw: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of normalizeSizeList(raw)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function parseDrops(raw: string) {
  const list = parseList(raw);
  return list.length ? list : [NO_DROP_CODE];
}

async function replaceDimension(
  table: "size_chart_sizes" | "size_chart_drops",
  chartId: string,
  codes: string[],
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from(table)
    .select("id, code, sort_order")
    .eq("chart_id", chartId)
    .order("sort_order");

  const rows = existing ?? [];
  for (const row of rows) {
    await supabase
      .from(table)
      .update({ sort_order: 100000 + row.sort_order })
      .eq("id", row.id);
  }

  const byCode = new Map(rows.map((r) => [r.code, r]));
  const keep = new Set<string>();
  let i = 1;
  for (const code of codes) {
    const found = byCode.get(code);
    if (found) {
      await supabase.from(table).update({ code, sort_order: i }).eq("id", found.id);
      keep.add(found.id);
    } else {
      const { data } = await supabase
        .from(table)
        .insert({ chart_id: chartId, code, sort_order: i })
        .select("id")
        .single();
      if (data) keep.add(data.id);
    }
    i += 1;
  }

  for (const row of rows) {
    if (keep.has(row.id)) continue;
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) {
      if (error.message.includes("foreign key")) {
        return table === "size_chart_drops"
          ? "Can't remove those drops while products still use them. Leave Drops empty to convert this chart to no drop."
          : "Can't remove those sizes while products still use them.";
      }
      return error.message;
    }
  }
  return null;
}

async function collapseToNoDrop(chartId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("collapse_chart_to_no_drop", {
    p_chart_id: chartId,
  });
  if (error) {
    if (error.message.includes("collapse_chart_to_no_drop")) {
      return "Run SQL 0015_collapse_no_drop.sql in Supabase, then save again.";
    }
    return error.message;
  }
  return null;
}

function revalidateCharts() {
  revalidatePath("/size-charts");
  revalidatePath("/items");
  revalidatePath("/models");
  revalidatePath("/products");
  revalidatePath("/inventory");
}

export async function addChart(formData: FormData) {
  const name = toSentenceCase(String(formData.get("name") ?? "").trim());
  if (!name) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("size_charts")
    .insert({ name })
    .select("id")
    .single();
  if (error || !data) return;
  const sizes = parseList(String(formData.get("sizes") ?? ""));
  const drops = parseDrops(String(formData.get("drops") ?? ""));
  if (sizes.length) await replaceDimension("size_chart_sizes", data.id, sizes);
  await replaceDimension("size_chart_drops", data.id, drops);
  revalidateCharts();
}

export async function updateChart(
  id: string,
  values: { name: string; sizes: string; drops: string },
) {
  const name = toSentenceCase(values.name.trim());
  if (!name) return "Enter a chart name.";
  const supabase = await createClient();
  const { error } = await supabase.from("size_charts").update({ name }).eq("id", id);
  if (error) return error.message;
  const sizeErr = await replaceDimension(
    "size_chart_sizes",
    id,
    parseList(values.sizes),
  );
  if (sizeErr) return sizeErr;
  const drops = parseDrops(values.drops);
  const dropErr =
    drops.length === 1 && drops[0] === NO_DROP_CODE
      ? await collapseToNoDrop(id)
      : await replaceDimension("size_chart_drops", id, drops);
  if (dropErr) return dropErr;
  revalidateCharts();
  return null;
}

export async function deleteChart(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("size_charts").delete().eq("id", id);
  if (error) return error.message;
  revalidateCharts();
  return null;
}
