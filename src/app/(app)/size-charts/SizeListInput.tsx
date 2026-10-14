"use client";

import { asTypedSizeList } from "@/lib/size-code";

export function SizeListInput({
  name,
  defaultValue = "",
  className,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      name={name}
      aria-label="Sizes"
      placeholder={placeholder}
      defaultValue={defaultValue}
      className={className}
      onInput={(e) => {
        const el = e.currentTarget;
        const next = asTypedSizeList(el.value);
        if (next !== el.value) el.value = next;
      }}
    />
  );
}
