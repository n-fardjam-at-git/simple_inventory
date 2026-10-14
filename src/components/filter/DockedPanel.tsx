"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Card } from "@/components/ui";

export function DockedPanel({
  open,
  onClose,
  title,
  side = "right",
  width = "70%",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  width?: string;
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
          aria-label="Close panel"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed bottom-0 z-50 flex flex-col bg-stone-50 p-4 transition-transform duration-300 ${
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
        <Card className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">{title}</h2>
            <button
              type="button"
              className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-sm">{children}</div>
        </Card>
      </aside>
    </>
  );
}
