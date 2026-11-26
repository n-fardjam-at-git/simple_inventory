import { SHIPPABLE_ORDER_STATUS } from "@/lib/customer-shipment";

/**
 * The pick list: order products a staff login has picked to ship.
 * It is kept in the browser for that login until Sign out or Clear, as ids only:
 * customer, then that customer's orders, then each order's picked products.
 */
export type PickOrder = { order_id: string; products: string[] };
export type PickCustomer = { customer_id: string; orders: PickOrder[] };
export type PickList = PickCustomer[];

/** The order product Back returns to on Customer orders. */
export type PickBack = { order_id: string; product_id: string | null };

const PREFIX = "pick-list";

export function pickListKey(userId: string) {
  return `${PREFIX}:${userId}`;
}

export function pickBackKey(userId: string) {
  return `${PREFIX}-back:${userId}`;
}

/** Every pick-list key in the browser, for Sign out. */
export function isPickListKey(key: string) {
  return key.startsWith(`${PREFIX}:`) || key.startsWith(`${PREFIX}-back:`);
}

function text(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function parsePickList(raw: string | null): PickList {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const list: PickList = [];
  for (const entry of data) {
    const customerId = text((entry as PickCustomer | null)?.customer_id);
    const orders = (entry as PickCustomer | null)?.orders;
    if (!customerId || !Array.isArray(orders)) continue;
    const kept: PickOrder[] = [];
    for (const order of orders) {
      const orderId = text((order as PickOrder | null)?.order_id);
      const products = (order as PickOrder | null)?.products;
      if (!orderId || !Array.isArray(products)) continue;
      const ids = [...new Set(products.filter((id): id is string => Boolean(text(id))))];
      if (ids.length) kept.push({ order_id: orderId, products: ids });
    }
    if (kept.length) list.push({ customer_id: customerId, orders: kept });
  }
  return list;
}

export function parsePickBack(raw: string | null): PickBack | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PickBack | null;
    const orderId = text(data?.order_id);
    return orderId ? { order_id: orderId, product_id: text(data?.product_id) } : null;
  } catch {
    return null;
  }
}

export function hasPick(list: PickList, orderId: string, productId: string) {
  return list.some((customer) =>
    customer.orders.some((order) => order.order_id === orderId && order.products.includes(productId)),
  );
}

export function countPicks(list: PickList) {
  return list.reduce(
    (sum, customer) => sum + customer.orders.reduce((n, order) => n + order.products.length, 0),
    0,
  );
}

export function pickedOrderIds(list: PickList) {
  return list.flatMap((customer) => customer.orders.map((order) => order.order_id));
}

/** Drops empty orders and empty customers. */
function tidy(list: PickList): PickList {
  return list
    .map((customer) => ({
      customer_id: customer.customer_id,
      orders: customer.orders.filter((order) => order.products.length > 0),
    }))
    .filter((customer) => customer.orders.length > 0);
}

export function addPicks(
  list: PickList,
  customerId: string,
  orderId: string,
  productIds: string[],
): PickList {
  if (!productIds.length) return list;
  // An order sits under one customer only.
  const others = removeOrders(list, [orderId]);
  const had = list
    .flatMap((customer) => customer.orders)
    .find((order) => order.order_id === orderId);
  const products = [...new Set([...(had?.products ?? []), ...productIds])];
  const order: PickOrder = { order_id: orderId, products };
  const found = others.some((customer) => customer.customer_id === customerId);
  return found
    ? others.map((customer) =>
        customer.customer_id === customerId
          ? { ...customer, orders: [...customer.orders, order] }
          : customer,
      )
    : [...others, { customer_id: customerId, orders: [order] }];
}

export function removePick(list: PickList, orderId: string, productId: string): PickList {
  return tidy(
    list.map((customer) => ({
      customer_id: customer.customer_id,
      orders: customer.orders.map((order) =>
        order.order_id === orderId
          ? { ...order, products: order.products.filter((id) => id !== productId) }
          : order,
      ),
    })),
  );
}

export function removeOrders(list: PickList, orderIds: string[]): PickList {
  const gone = new Set(orderIds);
  return tidy(
    list.map((customer) => ({
      customer_id: customer.customer_id,
      orders: customer.orders.filter((order) => !gone.has(order.order_id)),
    })),
  );
}

export function isShippableOrder(status: string | null | undefined) {
  return SHIPPABLE_ORDER_STATUS.includes(status as (typeof SHIPPABLE_ORDER_STATUS)[number]);
}

/**
 * A line can be picked while it is open, has something left to ship, and is not
 * already on a shipment that has not shipped (`picking`).
 */
export function isPickableLine(line: { status: string; left_to_ship?: number; picking?: boolean }) {
  return (
    !line.picking &&
    (line.status === "pending" || line.status === "back_order") &&
    (line.left_to_ship ?? 0) > 0
  );
}

type ShipHeader = {
  terms: string | null;
  shipment_method_id: string | null;
  shipping_method: string | null;
  sales_rep_id: string | null;
} & Record<string, unknown>;

const ADDRESS_PARTS = ["address_line1", "address_line2", "city", "region", "postal_code", "country"];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * The main properties a shipment's orders must share: ship-to, bill-to, terms,
 * shipping method, and sales rep. Two orders with the same key can ship together.
 * Mirrors the checks in `add_order_to_customer_shipment`.
 */
export function orderShipKey(order: ShipHeader) {
  const address = (prefix: "ship" | "bill") =>
    ADDRESS_PARTS.map((part) => clean(order[`${prefix}_${part}`])).join("|");
  return [
    address("ship"),
    address("bill"),
    clean(order.terms),
    order.shipment_method_id ?? "",
    clean(order.shipping_method),
    order.sales_rep_id ?? "",
  ].join("~");
}
