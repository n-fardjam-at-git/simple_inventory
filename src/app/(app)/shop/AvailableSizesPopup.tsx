"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DismissNote } from "@/components/DismissNote";
import { AvailableSizesMatrix } from "@/components/AvailableSizesMatrix";
import { loadAvailableSizes, type AvailableSizes } from "./actions";

export function AvailableSizesPopup({
  product,
  onClose,
}: {
  product: { id: string; name: string };
  onClose: () => void;
}) {
  const [data, setData] = useState<AvailableSizes | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setData(null);
    setErr(null);
    loadAvailableSizes(product.id).then((result) => {
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-[min(48rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
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
            <DismissNote className="text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          {data ? (
            <AvailableSizesMatrix
              sizes={data.sizes}
              drops={data.drops}
              cells={data.cells}
              upcharges={data.upcharges}
            />
          ) : err ? null : (
            <p className="text-sm text-stone-500">Loading…</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
