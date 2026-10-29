export function cuttingOrderLabel(order_num: number | null | undefined) {
  if (order_num == null) return "Cutting";
  return `Cutting ${order_num}`;
}

export function cuttingStatusOpen(raw: unknown): boolean {
  return raw === true || raw === "open" || raw === "t" || raw === "true";
}
