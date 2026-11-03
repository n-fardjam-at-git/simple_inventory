"use client";

import type { ReactNode } from "react";

export function FilterClear({
  onClear,
  onGo,
  goVisible = false,
  children,
}: {
  onClear: () => void;
  onGo?: () => void;
  goVisible?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative" data-clear-wrap="">
      {children}
      {goVisible && onGo ? (
        <button
          type="button"
          className="absolute top-1/2 right-6 z-10 -translate-y-1/2 px-0.5 text-sm leading-none text-stone-400 hover:text-stone-700"
          aria-label="Find"
          title="Find"
          onClick={onGo}
        >
          ←
        </button>
      ) : null}
      <button
        type="button"
        data-clear-btn=""
        className="absolute top-1/2 right-1 z-10 -translate-y-1/2 px-0.5 text-sm leading-none text-stone-400 hover:text-stone-700"
        aria-label="Clear"
        onClick={onClear}
      >
        ×
      </button>
    </div>
  );
}
