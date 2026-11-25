/** A shipment can still be changed while it is in one of these. */
export const SHIPMENT_OPEN_STATUS = ["pending", "picking", "picked", "boxed_ready"] as const;

export const SHIPMENT_STATUS = [...SHIPMENT_OPEN_STATUS, "shipped", "canceled"] as const;

/** An order can go on a shipment while it is in one of these. */
export const SHIPPABLE_ORDER_STATUS = ["approved", "picking", "back_order"] as const;

const LABELS: Record<string, string> = {
  pending: "Pending",
  picking: "Picking",
  picked: "Picked",
  boxed_ready: "Boxed & Ready",
  shipped: "Shipped",
  canceled: "Canceled",
};

export function shipmentStatusLabel(status: string | null | undefined) {
  if (!status) return "";
  return LABELS[status] ?? status;
}

export function isOpenShipment(status: string | null | undefined) {
  return SHIPMENT_OPEN_STATUS.includes(status as (typeof SHIPMENT_OPEN_STATUS)[number]);
}
