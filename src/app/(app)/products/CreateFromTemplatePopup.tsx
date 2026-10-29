"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FitList } from "@/components/list/FitList";
import { SelectableRow } from "@/components/list/ListTable";

export type ProductTemplateStamp = {
  id: string;
  name: string;
  brand_id: string;
  item_id: string;
  size_chart_id: string;
  chart_name: string;
  standard_price: number;
  size_ids: string[];
  drop_ids: string[];
  upcharges: { size_id: string; drop_id: string; amount: number }[];
};

export function CreateFromTemplatePopup({
  templates,
  onPaste,
  onClose,
}: {
  templates: ProductTemplateStamp[];
  onPaste: (tpl: ProductTemplateStamp) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const rows = [...templates].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-transparent"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 z-50 flex h-[24rem] w-[28rem] max-w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-stone-200 bg-stone-50 p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-stone-700">Create from template</p>
          <button
            type="button"
            className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {rows.length ? (
            <FitList
              items={rows}
              getKey={(r) => r.id}
              stretch
              thead={
                <thead>
                  <tr className="text-stone-500">
                    <th className="py-1">Name</th>
                    <th>Size chart</th>
                    <th></th>
                  </tr>
                </thead>
              }
              renderRow={(r) => (
                <SelectableRow id={r.id}>
                  <td className="py-1.5 font-medium">{r.name}</td>
                  <td>{r.chart_name}</td>
                  <td className="w-px whitespace-nowrap py-1">
                    <div className="inline-flex items-center rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
                      <button
                        type="button"
                        className="text-sm text-stone-700"
                        title="Paste"
                        aria-label="Paste"
                        onClick={() => onPaste(r)}
                      >
                        ←
                      </button>
                    </div>
                  </td>
                </SelectableRow>
              )}
            />
          ) : (
            <p className="text-sm text-stone-500">
              No templates for this brand, item, and chart.
            </p>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
