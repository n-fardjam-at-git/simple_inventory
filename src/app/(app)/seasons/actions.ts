"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePeriod } from "@/lib/season";

function revalidateSeasons() {
  revalidatePath("/seasons");
  revalidatePath("/products");
  revalidatePath("/products/new");
}

function readSeasonFields(yearRaw: unknown, periodRaw: string) {
  const year = Number(yearRaw);
  const { start_season, is_combo } = parsePeriod(periodRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "Enter a four-digit year." as const };
  }
  if (![1, 2, 3, 4].includes(start_season)) return { error: "Invalid season." as const };
  if (is_combo && start_season !== 1 && start_season !== 3) {
    return { error: "Combos can only be Spring/Summer or Fall/Winter." as const };
  }
  return { year, start_season, is_combo };
}

export async function addSeason(formData: FormData) {
  const parsed = readSeasonFields(formData.get("year"), String(formData.get("period") ?? "1:0"));
  if ("error" in parsed) return parsed.error;
  const supabase = await createClient();
  await supabase.from("seasons").insert({
    year: parsed.year,
    start_season: parsed.start_season,
    is_combo: parsed.is_combo,
  });
  revalidateSeasons();
}

export async function updateSeason(id: string, period: string, year: number) {
  const parsed = readSeasonFields(year, period);
  if ("error" in parsed) return parsed.error;
  const supabase = await createClient();
  const { data: before } = await supabase.from("seasons").select("season").eq("id", id).maybeSingle();
  const { data, error } = await supabase
    .from("seasons")
    .update({
      year: parsed.year,
      start_season: parsed.start_season,
      is_combo: parsed.is_combo,
    })
    .eq("id", id)
    .select("season")
    .single();
  if (error) return error.message;
  if (before?.season && data?.season && before.season !== data.season) {
    await supabase
      .from("products")
      .update({ availability: data.season })
      .eq("availability", before.season);
  }
  revalidateSeasons();
  return null;
}

export async function deleteSeason(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("seasons").delete().eq("id", id);
  if (error) return error.message;
  revalidateSeasons();
  return null;
}
