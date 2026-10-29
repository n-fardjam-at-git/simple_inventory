"use client";

import { useState, type ReactNode } from "react";

/** Red error or amber warning. The × clears this message only. */
export function DismissNote({
  children,
  className = "text-xs text-red-700",
  onDismiss,
}: {
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
}) {
  const [goneFor, setGoneFor] = useState<ReactNode>(null);
  if (!onDismiss && goneFor !== null && goneFor !== children) setGoneFor(null);
  if (!onDismiss && goneFor === children) return null;

  return (
    <p className={className}>
      <span>{children}</span>
      <button
        type="button"
        aria-label="Dismiss"
        className="ml-1 inline-block cursor-pointer align-text-top text-xs leading-none"
        onClick={() => {
          if (onDismiss) onDismiss();
          else setGoneFor(children);
        }}
      >
        ×
      </button>
    </p>
  );
}
