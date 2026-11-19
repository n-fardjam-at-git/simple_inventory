"use client";

import {
  OrderProductsPanel,
  type CatalogChoice,
  type ChargeChoice,
  type OrderProductLine,
  type SetItem,
} from "../customer-orders/OrderProductsPanel";
import {
  addRequestCharge,
  addRequestProduct,
  pasteRequestCells,
  removeRequestLine,
  saveRequestCharge,
  saveRequestPrice,
  saveRequestQty,
} from "./product-actions";
import type { DraftOrderLine, DraftOrderRow } from "./types";

const writes = {
  addProduct: addRequestProduct,
  addCharge: addRequestCharge,
  saveQty: saveRequestQty,
  savePrice: saveRequestPrice,
  saveCharge: saveRequestCharge,
  removeProduct: removeRequestLine,
  pasteCells: pasteRequestCells,
};

function toLine(line: DraftOrderLine): OrderProductLine {
  return {
    customer_order_id: line.request_id,
    product_id: line.product_id,
    status: "pending",
    type: line.type,
    qty: line.qty,
    price: line.price,
    label: line.name,
    item_id: line.item_id,
    item_name: line.item || "Item",
    size_chart_id: line.size_chart_id,
    ordered: line.ordered,
    shipped: 0,
    shipped_value: 0,
    sizes: line.sizes,
    drops: line.drops,
    cells: line.cells,
  };
}

export function DraftOrderPanel({
  open,
  onClose,
  order,
  lines,
  setItems,
  catalog,
  charges,
}: {
  open: boolean;
  onClose: () => void;
  order: DraftOrderRow | null;
  lines: DraftOrderLine[];
  setItems: SetItem[];
  catalog: CatalogChoice[];
  charges: ChargeChoice[];
}) {
  const productLines = order ? lines.filter((line) => line.request_id === order.id).map(toLine) : [];
  return (
    <OrderProductsPanel
      open={open}
      onClose={onClose}
      orderId={order?.id ?? null}
      orderNo={order?.request_no ?? null}
      customer={order?.customer ?? null}
      heading={order ? `${order.customer} · PO No ${order.request_no}` : "PO No"}
      lines={productLines}
      setItems={setItems}
      catalog={catalog}
      charges={charges}
      writes={writes}
      showLifecycle={false}
      readOnly={order?.status === "accepted"}
    />
  );
}
