"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Btn } from "@/components/ui";
import { DismissNote } from "@/components/DismissNote";
import type { Cell } from "@/components/matrix/QtyMatrix";
import { CuttingDropQtyGrid } from "../cutting-orders/CuttingDropQtyGrid";
import { loadShopQtyMatrix, type ShopQtyMatrix } from "./actions";
import { NextCuttingFold } from "./NextCuttingFold";

function qtyCells(form: FormData) {
  const cells: Cell[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("qty:")) continue;
    const parts = key.split(":");
    if (parts.length < 3) continue;
    const qty = Number(value) || 0;
    if (qty <= 0) continue;
    cells.push({ size_id: parts[1], drop_id: parts[2], qty });
  }
  return cells;
}

export function ShopQtyPopup({
  product,
  cells,
  onAdd,
  onClose,
}: {
  product: { id: string; name: string };
  cells: Cell[];
  onAdd: (cells: Cell[]) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ShopQtyMatrix | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancel = false;
    setData(null);
    setErr(null);
    setDirty(false);
    loadShopQtyMatrix(product.id).then((result) => {
      if (cancel) return;
      if (typeof result === "string") setErr(result);
      else setData(result);
    });
    return () => {
      cancel = true;
    };
  }, [product.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function add(form: HTMLFormElement) {
    const next = qtyCells(new FormData(form));
    if (!next.length) {
      setErr("Enter a quantity for at least one size.");
      return;
    }
    onAdd(next);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-[min(80rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <h2 className="min-w-0 truncate text-sm font-medium">{product.name}</h2>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-lg leading-none text-stone-500 hover:bg-stone-100"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {err ? (
            <DismissNote className="mb-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          {data ? (
            <form
              onInput={() => setDirty(true)}
              onSubmit={(event) => {
                event.preventDefault();
                add(event.currentTarget);
              }}
            >
              <p className="mb-2 flex items-center gap-2 text-xs text-stone-600">
                <span className="inline-block h-4 w-4 rounded-sm border border-green-200 bg-green-100" aria-hidden />
                Available
              </p>
              <CuttingDropQtyGrid
                key={product.id}
                sizes={data.sizes}
                drops={data.drops}
                cells={cells}
                available={data.available}
                editable
                qtyOnly
                namePrefix="qty"
                fitWidth
                onDirty={() => setDirty(true)}
              />
              <div className="mt-3">
                <NextCuttingFold productId={product.id} sizes={data.sizes} drops={data.drops} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                {dirty ? <Btn type="submit">Save</Btn> : null}
                <button
                  type="button"
                  className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </form>
          ) : err ? null : (
            <p className="text-sm text-stone-500">Loading…</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
