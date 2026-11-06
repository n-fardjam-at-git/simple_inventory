import { PRODUCT_TYPE } from "@/lib/product-type";

/** One order line, reduced to what the summary adds up. */
export type SummaryLine = {
  type: number;
  status: string;
  /** Item of the merchandise model (Suits, Pants). Null counts under Other. */
  item: string | null;
  /** Merchandise units, surcharge quantity, or 1 for freight. */
  ordered: number;
  extended: number;
  shipped: number;
  shipped_value: number;
};

export type ItemTotal = { item: string; units: number; amount: number };

export type OrderTotals = {
  /** Open merchandise grouped by item, sorted by item name, Other last. */
  items: ItemTotal[];
  units: number;
  merchandise: number;
  surcharge: number;
  freight: number;
  shipped_qty: number;
  shipped_value: number;
  total: number;
};

/**
 * The one place the order summary is added up. The customer orders panel, the report,
 * and the PDF all use it. Canceled lines print or show with their status but are left out here.
 */
export function summarizeOrder(lines: SummaryLine[]): OrderTotals {
  const open = lines.filter((line) => line.status !== "canceled");
  const sum = (list: SummaryLine[], pick: (line: SummaryLine) => number) =>
    list.reduce((total, line) => total + pick(line), 0);

  const merch = open.filter((line) => line.type === PRODUCT_TYPE.merchandise);
  const surcharge = sum(
    open.filter((line) => line.type === PRODUCT_TYPE.surcharge),
    (line) => line.extended,
  );
  const freight = sum(
    open.filter((line) => line.type === PRODUCT_TYPE.freight),
    (line) => line.extended,
  );
  const merchandise = sum(merch, (line) => line.extended);

  const byItem = new Map<string, ItemTotal>();
  for (const line of merch) {
    const key = line.item?.trim() || "Other";
    const row = byItem.get(key) ?? { item: key, units: 0, amount: 0 };
    row.units += line.ordered;
    row.amount += line.extended;
    byItem.set(key, row);
  }
  const items = [...byItem.values()].sort((a, b) => {
    if (a.item === "Other") return 1;
    if (b.item === "Other") return -1;
    return a.item.localeCompare(b.item, "en", { sensitivity: "base" });
  });

  return {
    items,
    units: sum(merch, (line) => line.ordered),
    merchandise,
    surcharge,
    freight,
    shipped_qty: sum(merch, (line) => line.shipped),
    shipped_value: sum(merch, (line) => line.shipped_value),
    total: merchandise + surcharge + freight,
  };
}
