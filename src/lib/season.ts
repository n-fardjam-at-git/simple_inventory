export const INSTOCK = "Instock";

export const SEASON = {
  spring: 1,
  summer: 2,
  fall: 3,
  winter: 4,
} as const;

export type SeasonRow = {
  id: string;
  year: number;
  start_season: number;
  is_combo: boolean;
  season: string;
};

const NAMES = ["Spring", "Summer", "Fall", "Winter"] as const;

export const SEASON_PERIODS: { start: number; combo: boolean; label: string }[] = [
  { start: 1, combo: false, label: "Spring" },
  { start: 1, combo: true, label: "Spring/Summer" },
  { start: 2, combo: false, label: "Summer" },
  { start: 3, combo: false, label: "Fall" },
  { start: 3, combo: true, label: "Fall/Winter" },
  { start: 4, combo: false, label: "Winter" },
];

export function seasonLabel(s: {
  season?: string | null;
  year: number;
  start_season: number;
  is_combo: boolean;
}) {
  if (s.season) return s.season;
  const a = NAMES[s.start_season - 1] ?? "Season";
  if (s.is_combo) {
    const b = NAMES[s.start_season] ?? "";
    return `${a}/${b} ${s.year}`;
  }
  return `${a} ${s.year}`;
}

export function asSeasonRows(rows: {
  id: string;
  year: number;
  start_season: number;
  is_combo: boolean;
  season?: string | null;
}[]) {
  return sortSeasonsDesc(
    rows.map((s) => ({
      id: s.id,
      year: Number(s.year),
      start_season: Number(s.start_season),
      is_combo: Boolean(s.is_combo),
      season: s.season ? String(s.season) : seasonLabel(s),
    })),
  );
}

export function sortSeasonsDesc(rows: SeasonRow[]) {
  return [...rows].sort((a, b) => b.year - a.year || b.start_season - a.start_season);
}

export function periodValue(start: number, combo: boolean) {
  return `${start}:${combo ? 1 : 0}`;
}

export function parsePeriod(raw: string) {
  const [startRaw, comboRaw] = String(raw ?? "1:0").split(":");
  return { start_season: Number(startRaw), is_combo: comboRaw === "1" };
}

export function parseAvailabilityValue(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (value === INSTOCK) return INSTOCK;
  return value;
}
