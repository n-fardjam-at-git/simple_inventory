"use client";

import type { InputHTMLAttributes } from "react";
import { toBrandCase, toSentenceCase } from "@/lib/text-case";

export function CasedInput({
  mode = "sentence",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { mode?: "sentence" | "brand" }) {
  const apply = mode === "brand" ? toBrandCase : toSentenceCase;
  return (
    <input
      {...props}
      onInput={(e) => {
        const el = e.currentTarget;
        const next = apply(el.value);
        if (next !== el.value) {
          const start = el.selectionStart;
          el.value = next;
          if (start != null) el.setSelectionRange(start, start);
        }
        props.onInput?.(e);
      }}
    />
  );
}
