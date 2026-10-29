"use client";

import type { ReactNode } from "react";

export function WorkingBeside({ side = "left" }: { side?: "left" | "right" }) {
  const place =
    side === "right" ? "left-full ml-1.5" : "right-full mr-1.5";
  return (
    <span
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs whitespace-nowrap text-stone-400 ${place}`}
    >
      Working…
    </span>
  );
}

/** Floats Working… beside the control that started a write. */
export function Busy({
  on,
  side = "left",
  children,
  className = "",
}: {
  on: boolean;
  side?: "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex ${className}`.trim()}>
      {children}
      {on ? <WorkingBeside side={side} /> : null}
    </span>
  );
}
