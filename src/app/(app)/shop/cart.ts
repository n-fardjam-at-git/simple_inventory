import type { Cell } from "@/components/matrix/QtyMatrix";

export type CartLine = { productId: string; cells: Cell[] };

export function cartKey(customerId: string) {
  return `shop-cart:${customerId}`;
}

/** Reads the shop cart. Old carts stored only product ids. */
export function readCart(raw: string | null, productIds: Set<string>): CartLine[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const lines: CartLine[] = [];
  for (const item of parsed) {
    if (typeof item === "string") {
      if (productIds.has(item)) lines.push({ productId: item, cells: [] });
      continue;
    }
    if (!item || typeof item !== "object" || !("productId" in item)) continue;
    const productId = String((item as { productId: unknown }).productId);
    if (!productIds.has(productId)) continue;
    const cells = Array.isArray((item as { cells?: unknown }).cells)
      ? (item as { cells: Cell[] }).cells.filter((cell) => cell && Number(cell.qty) > 0)
      : [];
    lines.push({ productId, cells });
  }
  return lines;
}
