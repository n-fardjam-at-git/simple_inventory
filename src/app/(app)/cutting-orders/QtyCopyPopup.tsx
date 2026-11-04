"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Busy } from "@/components/WorkingBeside";
import { Btn } from "@/components/ui";
import { FitList } from "@/components/list/FitList";
import { SelectableRow } from "@/components/list/ListTable";
import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { CuttingDropQtyGrid } from "./CuttingDropQtyGrid";

export type QtyCopy = {
  id: string;
  itemId: string;
  sizeChartId: string;
  itemName: string;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};

export type QtyCopyTarget = {
  product_id: string;
  item_id: string | null;
  size_chart_id: string | null;
  label: string;
  cells: { qty?: number | null }[];
};

function sizedTotal(cells: Cell[]) {
  return cells.reduce((s, c) => s + Number(c.qty ?? 0), 0);
}

export function snapshotQtyCopy(row: {
  item_id: string | null;
  size_chart_id: string | null;
  itemName: string;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
}): QtyCopy | null {
  if (!row.item_id || !row.size_chart_id) return null;
  const cells = row.cells.filter((c) => Number(c.qty ?? 0) > 0);
  if (!cells.length) return null;
  return {
    id: crypto.randomUUID(),
    itemId: row.item_id,
    sizeChartId: row.size_chart_id,
    itemName: row.itemName.trim() || "Item",
    sizes: row.sizes,
    drops: row.drops,
    cells: cells.map((c) => ({
      size_id: c.size_id,
      drop_id: c.drop_id,
      qty: Number(c.qty ?? 0),
    })),
  };
}

export function QtyCopyPopup({
  open,
  product,
  copies,
  onCopy,
  onPaste,
  onClear,
  onDelete,
  onClose,
}: {
  open: boolean;
  product: QtyCopyTarget | null;
  copies: QtyCopy[];
  onCopy: () => void;
  onPaste: (copy: QtyCopy, mode: "replace" | "combine") => Promise<string | null>;
  onClear: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "paste" | "replace" | "combine">(null);
  const [confirmPaste, setConfirmPaste] = useState<QtyCopy | null>(null);
  const canCopy = Boolean(product?.cells.some((c) => Number(c.qty ?? 0) > 0));
  const alreadySized = Boolean(product?.cells.some((c) => Number(c.qty ?? 0) > 0));

  useEffect(() => {
    if (!open) {
      setErr(null);
      setConfirmPaste(null);
    }
  }, [open, product?.product_id]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (confirmPaste) {
        setConfirmPaste(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose, confirmPaste]);

  function matches(copy: QtyCopy) {
    return (
      Boolean(product?.item_id) &&
      Boolean(product?.size_chart_id) &&
      copy.itemId === product?.item_id &&
      copy.sizeChartId === product?.size_chart_id
    );
  }

  function paste(copy: QtyCopy) {
    if (!product) return;
    if (!matches(copy)) {
      setErr("That copy does not match this product’s item and size chart.");
      return;
    }
    if (alreadySized) {
      setConfirmPaste(copy);
      return;
    }
    runPaste(copy, "replace", "paste");
  }

  function runPaste(copy: QtyCopy, mode: "replace" | "combine", source: "paste" | "replace" | "combine") {
    if (!product) return;
    setJob(source);
    start(async () => {
      try {
        const message = await onPaste(copy, mode);
        if (message) {
          setErr(message);
          return;
        }
        setErr(null);
        setConfirmPaste(null);
        router.refresh();
        onClose();
      } finally {
        setJob(null);
      }
    });
  }

  if (!open || !product || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] bg-transparent"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 z-[90] flex h-[min(28rem,70vh)] w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
          <p className="min-w-0 truncate text-sm text-stone-800">
            <span className="font-medium">Copy</span>
            <span className="font-light text-stone-500"> • {product.label}</span>
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
          <div className="flex shrink-0 items-center gap-2">
            {canCopy ? (
              <Btn type="button" onClick={onCopy}>
                Copy
              </Btn>
            ) : null}
            <button
              type="button"
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
              disabled={copies.length === 0}
              onClick={onClear}
            >
              Clear
            </button>
          </div>
          {err ? (
            <DismissNote className="shrink-0 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <FitList
            items={copies}
            getKey={(c) => c.id}
            stretch
            tableClassName="inventory-boards table-fixed"
            thead={
              <thead>
                <tr className="text-stone-500">
                  <th className="w-28 py-1">Item</th>
                  <th className="w-full py-1"></th>
                  <th className="w-16 py-1">Total</th>
                  <th className="w-28 py-1"></th>
                </tr>
              </thead>
            }
            renderRow={(c) => (
              <SelectableRow id={c.id}>
                <td className="w-28 pr-2">
                  <div className="font-medium leading-tight">{c.itemName}</div>
                </td>
                <td className="w-full min-w-0 pr-1">
                  <CuttingDropQtyGrid sizes={c.sizes} drops={c.drops} cells={c.cells} />
                </td>
                <td className="w-16 pr-2 text-right text-xs font-medium tabular-nums">
                  {sizedTotal(c.cells)}
                </td>
                <td className="w-28 whitespace-nowrap py-1 pr-2">
                  <div className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
                    {matches(c) ? (
                      <Busy on={job === "paste"}>
                        <button
                          type="button"
                          className="text-xs font-medium text-teal-800 underline disabled:opacity-50"
                          disabled={job != null}
                          onClick={() => paste(c)}
                        >
                          Paste
                        </button>
                      </Busy>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs text-red-700 underline"
                      onClick={() => onDelete(c.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </SelectableRow>
            )}
          />
        </div>
      </div>
      {confirmPaste ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="max-w-sm rounded-lg bg-white p-4 shadow-lg">
            <p className="mb-4 text-sm">This product is already sized</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Busy on={job === "replace"}>
                <button
                  type="button"
                  className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                  disabled={job != null}
                  onClick={() => runPaste(confirmPaste, "replace", "replace")}
                >
                  Replace
                </button>
              </Busy>
              <Busy on={job === "combine"}>
                <button
                  type="button"
                  className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                  disabled={job != null}
                  onClick={() => runPaste(confirmPaste, "combine", "combine")}
                >
                  Combine
                </button>
              </Busy>
              <button
                type="button"
                autoFocus
                className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800"
                disabled={job != null}
                onClick={() => setConfirmPaste(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
