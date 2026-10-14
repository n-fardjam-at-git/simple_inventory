export function cuttingOrderLabel(order_num: number | null | undefined) {
  if (order_num == null) return "Cutting";
  return `Cutting ${order_num}`;
}
