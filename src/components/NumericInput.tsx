"use client";

import type { FocusEvent, InputHTMLAttributes, MouseEvent } from "react";

export function selectOnNumericFocus(e: FocusEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  el.dataset.justFocused = "1";
  el.select();
}

export function keepNumericSelectOnMouseUp(e: MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  if (el.dataset.justFocused) {
    e.preventDefault();
    el.select();
    delete el.dataset.justFocused;
  }
}

function sanitizeNumeric(raw: string, decimal: boolean) {
  if (!decimal) return raw.replace(/[^0-9]/g, "");
  const next = raw.replace(/[^0-9.]/g, "");
  const i = next.indexOf(".");
  if (i === -1) return next;
  return next.slice(0, i + 1) + next.slice(i + 1).replace(/\./g, "");
}

export function NumericInput({
  onFocus,
  onMouseUp,
  onChange,
  onBeforeInput,
  inputMode,
  decimal = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { decimal?: boolean }) {
  return (
    <input
      {...props}
      inputMode={inputMode ?? (decimal ? "decimal" : "numeric")}
      onFocus={(e) => {
        selectOnNumericFocus(e);
        onFocus?.(e);
      }}
      onMouseUp={(e) => {
        keepNumericSelectOnMouseUp(e);
        onMouseUp?.(e);
      }}
      onBeforeInput={(e) => {
        const data = "data" in e.nativeEvent ? e.nativeEvent.data : null;
        if (typeof data === "string" && data !== sanitizeNumeric(data, decimal)) {
          if (!sanitizeNumeric(data, decimal)) e.preventDefault();
        }
        onBeforeInput?.(e);
      }}
      onChange={(e) => {
        const cleaned = sanitizeNumeric(e.target.value, decimal);
        if (e.target.value !== cleaned) e.target.value = cleaned;
        onChange?.(e);
      }}
    />
  );
}
