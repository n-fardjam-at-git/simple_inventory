"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

export function DockedPanel({
  open,
  onClose,
  title,
  subtitle,
  side = "right",
  width = "70%",
  nested = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  side?: "left" | "right";
  width?: string;
  nested?: boolean;
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
      if (e.key !== "Escape") return;
      if (nested) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      onClose();
    }
    window.addEventListener("keydown", onKey, nested);
    return () => window.removeEventListener("keydown", onKey, nested);
  }, [open, onClose, nested]);

  const fromRight = side === "right";

  return (
    <>
      {open ? (
        <button
          type="button"
          className={`fixed right-0 bottom-0 left-0 bg-transparent ${nested ? "z-[55]" : "z-40"}`}
          style={{ top: headerBottom }}
          aria-label="Close panel"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed bottom-0 flex flex-col bg-[#eee8d3] p-4 transition-transform duration-300 ${
          nested ? "z-[60]" : "z-50"
        } ${
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
        style={{ top: headerBottom, width }}
        aria-hidden={!open}
      >
        <div className="dock-panel flex min-h-0 flex-1 flex-col rounded-lg border border-[#ddd5bb] bg-[#f8f5e8] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="font-medium">{title}</h2>
              {subtitle ? (
                <p className="text-sm font-light text-stone-500">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <div data-clip="" className="flex min-h-0 flex-1 flex-col overflow-hidden text-sm">
            {children}
          </div>
        </div>
      </aside>
    </>
  );
}
