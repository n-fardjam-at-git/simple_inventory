"use client";

import { useState, type InputHTMLAttributes } from "react";
import { keepNumericSelectOnMouseUp, selectOnNumericFocus } from "@/components/NumericInput";

function digitsOnly(raw: string) {
  return raw.replace(/[^0-9.]/g, "");
}

export function PriceInput({
  name,
  defaultValue,
  className = "",
  blankZero = false,
  onChange,
  onFocus,
  onMouseUp,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { blankZero?: boolean }) {
  const numeric =
    defaultValue === undefined || defaultValue === null
      ? ""
      : String(defaultValue);
  const initial =
    blankZero && (numeric === "" || Number(numeric) === 0) ? "" : numeric;
  const [amount, setAmount] = useState(initial);

  return (
    <>
      {name ? <input type="hidden" name={name} value={amount} /> : null}
      <input
        {...props}
        name={undefined}
        inputMode="decimal"
        value={amount === "" ? "" : `$${amount}`}
        className={className}
        onFocus={(e) => {
          selectOnNumericFocus(e);
          onFocus?.(e);
        }}
        onMouseUp={(e) => {
          keepNumericSelectOnMouseUp(e);
          onMouseUp?.(e);
        }}
        onChange={(e) => {
          const next = digitsOnly(e.target.value);
          setAmount(next);
          onChange?.(e);
        }}
      />
    </>
  );
}
