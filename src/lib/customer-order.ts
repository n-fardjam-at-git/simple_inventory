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

export const ONLINE_BY_CUSTOMER = "Online by customer";

export const ONLINE_BY_SALES_REP = "Online by sales rep";

export const LINE_PRICE_NOTICE =
  "All prices are line prices, any agreed discount will be applied by our staff and will be sent back to you to confirm.";

/** Blank staff reply shows the line-price notice. A saved reply is left as written. */
export function staffReplyText(reply: string | null | undefined) {
  const text = reply?.trim() ?? "";
  return text ? (reply ?? "") : LINE_PRICE_NOTICE;
}

/** Blank is missing. A date before the start is too early. Dates are `YYYY-MM-DD`. */
export function deliverByMessage(start: string | null, deliverBy: string | null) {
  const by = deliverBy?.trim() || "";
  if (!by) return "Enter a deliver-by date.";
  const from = start?.trim() || "";
  if (from && by < from) return "Deliver by must be on or after the start date.";
  return null;
}

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
