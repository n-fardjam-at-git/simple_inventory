"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Btn } from "@/components/ui";

export function filterToggleClass(isFiltered: boolean) {
  return isFiltered
    ? "rounded border border-red-700 bg-red-600/15 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-600/25"
    : "rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50";
}

export function DockedFilterPanel({
  open,
  onClose,
  onApply,
  onReset,
  comboKey,
  side = "left",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  comboKey: number;
  side?: "left" | "right";
  children: ReactNode;
}) {
  const [headerBottom, setHeaderBottom] = useState(0);

  useLayoutEffect(() => {
    const header = document.querySelector("header");
    function measure() {
      setHeaderBottom(header ? Math.round(header.getBoundingClientRect().bottom) : 0);
    }
    measure();
    const ro = header ? new ResizeObserver(measure) : null;
    if (header) ro?.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const fromRight = side === "right";

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed right-0 bottom-0 left-0 z-40 bg-transparent"
          style={{ top: headerBottom }}
          aria-label="Close filter"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed bottom-0 z-50 flex w-[30%] flex-col bg-slate-100 p-4 transition-transform duration-300 ${
          fromRight
            ? "right-0 shadow-[-8px_0_24px_rgba(0,0,0,0.12)]"
            : "left-0 shadow-[8px_0_24px_rgba(0,0,0,0.12)]"
        } ${
          open
            ? "translate-x-0"
            : fromRight
              ? "pointer-events-none translate-x-full"
              : "pointer-events-none -translate-x-full"
        }`}
        style={{ top: headerBottom }}
        aria-hidden={!open}
      >
        <div className="dock-panel flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Filter</h2>
            <button
              type="button"
              className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              onApply();
            }}
          >
            <div key={comboKey} className="flex-1 space-y-3 overflow-auto text-sm">
              {children}
            </div>
            <div className="mt-3 flex gap-2">
              <Btn type="submit">Filter</Btn>
              <button
                type="button"
                className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
                onClick={onReset}
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
