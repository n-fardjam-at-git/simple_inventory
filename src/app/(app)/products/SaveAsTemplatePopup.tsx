"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { saveProductAsTemplate } from "./actions";

export type ProductTemplateOption = {
  id: string;
  name: string;
  brand_id: string;
  item_id: string;
  size_chart_id: string;
};

export function SaveAsTemplatePopup({
  productId,
  templates,
  anchor,
  onClose,
}: {
  productId: string;
  templates: ProductTemplateOption[];
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () =>
      [...templates]
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
        .map((t) => ({ id: t.id, label: t.name })),
    [templates],
  );
  const existing = templates.find((t) => t.id === value) ?? null;

  useLayoutEffect(() => {
    const r = anchor?.getBoundingClientRect();
    if (!r) return;
    const width = 288;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const top = r.bottom + 4;
    setPos({ top, left });
  }, [anchor]);

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

  function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setErr("Enter a name.");
      return;
    }
    start(async () => {
      const message = await saveProductAsTemplate(
        productId,
        existing ? existing.name : trimmed,
        existing?.id ?? null,
      );
      if (message) {
        setErr(message);
        return;
      }
      onClose();
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-transparent"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={boxRef}
        className="fixed z-50 w-72 rounded-lg border border-stone-200 bg-white p-3 shadow-lg"
        style={{ top: pos.top, left: pos.left }}
      >
        <p className="mb-2 text-sm font-medium text-stone-700">Save as template</p>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Name</span>
          <ComboBox
            allowEmpty
            allowAny
            className="w-full rounded border px-2 py-1"
            value={value}
            onChange={setValue}
            options={options}
          />
        </label>
        {err ? (
          <DismissNote className="mt-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
            {err}
          </DismissNote>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Btn type="button" busy={pending} onClick={save}>
            {existing ? "Update" : "OK"}
          </Btn>
          <button
            type="button"
            className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
