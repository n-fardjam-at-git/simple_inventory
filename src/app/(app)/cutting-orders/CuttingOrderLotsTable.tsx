"use client";

import { DismissNote } from "@/components/DismissNote";
import { useState, useTransition, type MouseEvent } from "react";
import { Busy } from "@/components/WorkingBeside";
import { FitList } from "@/components/list/FitList";
import { deleteCuttingOrderLot } from "./actions";

export type CuttingOrderLotRow = {
  cutting_order_id: string;
  lot_id: string;
  lot_no: string;
  article: string | null;
  has_products: boolean;
};

export function CuttingOrderLotsTable({
  rows,
  selectId,
  onSelect,
}: {
  rows: CuttingOrderLotRow[];
  selectId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.lot_id}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Lot No</th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => (
        <OrderLotRow row={r} selected={selectId === r.lot_id} onSelect={onSelect} />
      )}
    />
  );
}

function OrderLotRow({
  row,
  selected,
  onSelect,
}: {
  row: CuttingOrderLotRow;
  selected: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, textarea, label")) return;
    onSelect?.(row.lot_id);
  }

  return (
    <tr className={selected ? "is-selected" : ""} onClick={onClick}>
      <td className="py-1.5 pr-2">
        <div className="font-medium leading-tight">{row.lot_no}</div>
        {row.article ? (
          <p className="text-xs font-light leading-tight text-stone-500">{row.article}</p>
        ) : null}
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      <td className="w-px whitespace-nowrap py-1">
        <div className="inline-flex items-center rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
          <Busy on={pending}>
            <button
              type="button"
              className="text-xs text-red-700 underline disabled:opacity-50"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Remove ${row.lot_no}?`)) return;
                start(async () => {
                  const message = await deleteCuttingOrderLot(row.cutting_order_id, row.lot_id);
                  if (message) setErr(message);
                });
              }}
            >
              Delete
            </button>
          </Busy>
        </div>
      </td>
    </tr>
  );
}
