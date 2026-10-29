"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useState, useTransition, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Btn } from "@/components/ui";
import { FitList } from "@/components/list/FitList";
import { addVendorShipmentProducts } from "./actions";
import type { CatalogCuttingProduct } from "./types";

export function AddShipmentProductsPopup({
  open,
  shipmentId,
  cuttingOrderId,
  cuttingNo,
  products,
  onAdded,
  onClose,
}: {
  open: boolean;
  shipmentId: string;
  cuttingOrderId: string;
  cuttingNo: number | null;
  products: CatalogCuttingProduct[];
  onAdded: (productIds: string[]) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const rows = [...products].sort((a, b) =>
    a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
  );

  useEffect(() => {
    if (!open) return;
    setChecked(new Set());
    setErr(null);
  }, [open, cuttingOrderId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  function toggle(productId: string) {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  const allSelected = rows.length > 0 && rows.every((r) => checked.has(r.product_id));
  const someSelected = rows.some((r) => checked.has(r.product_id));

  function toggleAll() {
    setChecked(allSelected ? new Set() : new Set(rows.map((r) => r.product_id)));
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] bg-transparent"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 z-[90] flex h-[min(28rem,70vh)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
          <p className="min-w-0 truncate text-sm text-stone-800">
            <span className="font-medium">Add products</span>
            {cuttingNo != null ? (
              <span className="font-light text-stone-500"> • {cuttingNo}</span>
            ) : null}
          </p>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-lg leading-none text-stone-500 hover:bg-stone-100"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          {rows.length ? (
            <FitList
              items={rows}
              getKey={(r) => r.product_id}
              stretch
              thead={
                <thead>
                  <tr className="text-stone-500">
                    <th className="w-8 py-1">
                      <SelectAllCheck
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        onToggle={toggleAll}
                      />
                    </th>
                    <th className="py-1">Product</th>
                  </tr>
                </thead>
              }
              renderRow={(r) => (
                <ProductPickRow
                  row={r}
                  checked={checked.has(r.product_id)}
                  onToggle={() => toggle(r.product_id)}
                />
              )}
            />
          ) : (
            <p className="text-sm text-stone-500">No open products to add.</p>
          )}
          {err ? (
            <DismissNote className="shrink-0 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <div className="flex shrink-0 justify-end gap-2">
            <button
              type="button"
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <Btn
              type="button"
              busy={pending}
              disabled={pending || checked.size === 0}
              onClick={() => {
                const ids = [...checked];
                start(async () => {
                  const message = await addVendorShipmentProducts(
                    shipmentId,
                    cuttingOrderId,
                    ids,
                  );
                  if (message) {
                    setErr(message);
                    return;
                  }
                  onAdded(ids);
                });
              }}
            >
              Add
            </Btn>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function SelectAllCheck({
  checked,
  indeterminate,
  onToggle,
}: {
  checked: boolean;
  indeterminate: boolean;
  onToggle: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onToggle}
      aria-label="Select all"
    />
  );
}

function ProductPickRow({
  row,
  checked,
  onToggle,
}: {
  row: CatalogCuttingProduct;
  checked: boolean;
  onToggle: () => void;
}) {
  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, textarea, label")) return;
    onToggle();
  }

  return (
    <tr className={checked ? "is-selected" : ""} onClick={onClick}>
      <td className="w-8 py-1.5 pr-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${row.label}`}
        />
      </td>
      <td className="py-1.5">{row.label}</td>
    </tr>
  );
}
