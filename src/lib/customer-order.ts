export const ORDER_STATUS = [
  "pending",
  "approved",
  "picking",
  "back_order",
  "short_shipped",
  "complete",
  "canceled",
] as const;

export const LINE_STATUS = [
  "pending",
  "back_order",
  "short_shipped",
  "complete",
  "canceled",
] as const;

export const WORKFLOW_STATUS = ["pending", "approved", "picking"] as const;

export const SHIP_AT_ONCE = "Ship at once";

const LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  picking: "Picking",
  back_order: "Back order",
  short_shipped: "Short shipped",
  complete: "Complete",
  canceled: "Canceled",
};

export function shipmentMethodLabel(row: { shipper: string | null; method: string }) {
  return row.shipper ? `${row.shipper} · ${row.method}` : row.method;
}

export function orderStatusLabel(status: string | null | undefined) {
  if (!status) return "";
  return LABELS[status] ?? status;
}

export function commissionPercent(rate: number | null | undefined) {
  if (rate == null || Number.isNaN(Number(rate))) return "";
  const pct = Number(rate) * 100;
  return String(Math.round(pct * 100) / 100);
}

export function parseCommissionPercent(raw: string) {
  const text = raw.trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return Math.round(n * 100) / 10000;
}
