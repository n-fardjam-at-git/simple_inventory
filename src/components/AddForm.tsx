"use client";

import { useRef, type ReactNode } from "react";

export function AddForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<unknown>;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      action={async (formData) => {
        const result = await action(formData);
        if (typeof result === "string" && result) return;
        ref.current?.reset();
      }}
    >
      {children}
    </form>
  );
}
