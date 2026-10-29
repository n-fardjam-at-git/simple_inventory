"use client";

import { useFormStatus } from "react-dom";
import { Busy } from "@/components/WorkingBeside";

export function PageTitle({
  title,
  actions,
  className = "mb-6",
}: {
  title: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {actions}
    </div>
  );
}

export function Card({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-stone-200 bg-white p-4 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Btn({
  children,
  type,
  disabled,
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Show Working… for a click that is not a form submit. */
  busy?: boolean;
}) {
  const { pending } = useFormStatus();
  const submit = type === undefined || type === "submit";
  const on = busy || (submit && pending);
  return (
    <Busy on={on} side="right">
      <button
        type={type}
        disabled={disabled || on}
        className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        {...props}
      >
        {children}
      </button>
    </Busy>
  );
}
