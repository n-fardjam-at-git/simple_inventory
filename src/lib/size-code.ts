/** Convert ASCII 1/2 to ½ when followed by space or comma (while typing). */
export function asTypedSizeList(value: string) {
  return value.replace(/1\/2(?=[ ,])/g, "½");
}

/** Same conversion, also at end of the string (on save). */
export function normalizeSizeList(value: string) {
  return value.replace(/1\/2(?=[ ,]|$)/g, "½");
}

/** Stored on a chart that has no length/drop axis. Never shown in the UI. */
export const NO_DROP_CODE = "";

export function isNoDropCode(code: string | null | undefined) {
  return !(code ?? "").trim();
}

export function visibleDrops<T extends { code: string }>(drops: T[]) {
  return drops.filter((d) => !isNoDropCode(d.code));
}

export function isNoDropAxis(drops: { code: string }[]) {
  return drops.length > 0 && visibleDrops(drops).length === 0;
}

/** Named drops if any are selected; otherwise the hidden no-drop row. */
export function resolveProductDropIds(
  chartDrops: { id: string; code: string }[],
  requestedIds: string[],
): { ids: string[]; error: string | null } {
  const namedIds = new Set(visibleDrops(chartDrops).map((d) => d.id));
  const sentinels = chartDrops.filter((d) => isNoDropCode(d.code)).map((d) => d.id);
  const pickedNamed = requestedIds.filter((id) => namedIds.has(id));
  if (pickedNamed.length) return { ids: [...new Set(pickedNamed)], error: null };
  if (sentinels.length) return { ids: sentinels, error: null };
  return {
    ids: [],
    error: "Keep at least one drop, or clear Drops on the size chart.",
  };
}
