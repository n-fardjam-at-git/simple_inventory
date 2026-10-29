"use client";

import { useMemo } from "react";
import { DockedPanel } from "@/components/filter/DockedPanel";
import { FitList } from "@/components/list/FitList";
import { SelectableRow } from "@/components/list/ListTable";
import { CuttingDropQtyGrid } from "@/app/(app)/cutting-orders/CuttingDropQtyGrid";
import type { VendorCuttingLine, VendorCuttingRow } from "./types";

export function VendorCuttingPanel({
  open,
  onClose,
  cutting,
  lines,
}: {
  open: boolean;
  onClose: () => void;
  cutting: VendorCuttingRow | null;
  lines: VendorCuttingLine[];
}) {
  const viewRows = useMemo(() => {
    const rows = cutting ? lines.filter((l) => l.cutting_order_id === cutting.id) : [];
    return [...rows].sort((a, b) =>
      a.product_label.localeCompare(b.product_label, "en", { sensitivity: "base" }),
    );
  }, [lines, cutting]);

  return (
    <DockedPanel
      open={open}
      onClose={onClose}
      title={cutting ? String(cutting.order_num) : "Cutting"}
      subtitle={
        cutting
          ? [cutting.brand, `Submitted ${cutting.date_submitted}`, cutting.open ? "Open" : "Closed"]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      side="right"
      width="95%"
    >
      {open && cutting ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {viewRows.length === 0 ? (
            <p className="text-sm text-stone-500">No products on this cutting.</p>
          ) : (
            <FitList
              items={viewRows}
              getKey={(r) => r.id}
              stretch
              tableClassName="inventory-boards table-fixed"
              thead={
                <thead>
                  <tr className="text-stone-500">
                    <th className="w-52 py-1">Product</th>
                    <th className="w-full py-1"></th>
                  </tr>
                </thead>
              }
              renderRow={(r) => {
                return (
                  <SelectableRow id={r.id}>
                    <td className="w-52 py-1.5 pr-2">
                      <div className="font-medium leading-tight">{r.product_label}</div>
                      {r.bulk_order_qty != null ? (
                        <div className="text-xs text-stone-500">Bulk • {r.bulk_order_qty}</div>
                      ) : null}
                    </td>
                    <td className="w-full min-w-0 pr-1">
                      {r.sizes.length > 0 && r.cells.length > 0 ? (
                        <CuttingDropQtyGrid sizes={r.sizes} drops={r.drops} cells={r.cells} />
                      ) : (
                        <p className="text-sm text-stone-400">Not sized</p>
                      )}
                    </td>
                  </SelectableRow>
                );
              }}
            />
          )}
        </div>
      ) : null}
    </DockedPanel>
  );
}
