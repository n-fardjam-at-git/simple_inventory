"use client";

import { DockedPanel } from "@/components/filter/DockedPanel";
import { CuttingDropQtyGrid } from "../cutting-orders/CuttingDropQtyGrid";
import type { DraftOrderLine, DraftOrderRow } from "./types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function usDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${m}/${d}/${y}`;
}

export function DraftOrderPanel({
  open,
  onClose,
  order,
  lines,
}: {
  open: boolean;
  onClose: () => void;
  order: DraftOrderRow | null;
  lines: DraftOrderLine[];
}) {
  const products = order
    ? lines
        .filter((line) => line.request_id === order.id)
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
    : [];

  return (
    <DockedPanel
      open={open}
      onClose={onClose}
      title={order ? `PO No ${order.request_no}` : "PO No"}
      subtitle={order?.customer}
      side="right"
      width="95%"
    >
      {open && order ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          <div className="grid shrink-0 grid-cols-2 gap-x-6 text-xs">
            <p>
              <span className="text-stone-500">Season</span> {order.future_season || "—"}
            </p>
            <p>
              <span className="text-stone-500">Start</span> {usDate(order.start_date)}
            </p>
            <p>
              <span className="text-stone-500">Cancel date</span> {usDate(order.cancel_date)}
            </p>
            <p>
              <span className="text-stone-500">Date</span> {usDate(order.created_at)}
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-4 text-xs">
            <div>
              <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-stone-500 uppercase">Ship to</p>
              {order.ship.length ? (
                order.ship.map((line, index) => <p key={index}>{line}</p>)
              ) : (
                <p className="text-stone-400">No address</p>
              )}
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-stone-500 uppercase">Bill to</p>
              {order.bill.length ? (
                order.bill.map((line, index) => <p key={index}>{line}</p>)
              ) : (
                <p className="text-stone-400">No address</p>
              )}
            </div>
          </div>
          {order.notes ? (
            <p className="shrink-0 text-xs">
              <span className="text-stone-500">Notes</span> {order.notes}
            </p>
          ) : null}
          {products.length === 0 ? (
            <p className="text-sm text-stone-500">No products on this order.</p>
          ) : (
            <ul className="space-y-3">
              {products.map((line) => (
                <li key={line.product_id} className="rounded-lg border border-[#ddd5bb] bg-white p-3">
                  <p className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{line.name}</span>
                    <span className="tabular-nums">{usd.format(line.price)}</span>
                  </p>
                  <CuttingDropQtyGrid
                    sizes={line.sizes}
                    drops={line.drops}
                    cells={line.cells}
                    editable={false}
                    qtyOnly
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </DockedPanel>
  );
}
