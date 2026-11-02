"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui";
import { AddForm } from "@/components/AddForm";
import { CasedInput } from "@/components/CasedInput";
import { DismissNote } from "@/components/DismissNote";
import { NumericInput } from "@/components/NumericInput";
import { addPaymentTerm } from "./actions";

export function NewTermForm() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  return (
    <AddForm
      action={async (formData) => {
        const message = await addPaymentTerm(formData);
        if (typeof message === "string" && message) {
          setErr(message);
          return message;
        }
        setErr(null);
        router.refresh();
      }}
      className="flex shrink-0 flex-wrap items-center gap-2 text-sm"
    >
      <input
        name="term"
        required
        aria-label="Term"
        placeholder="Term"
        className="rounded border px-2 py-1"
      />
      <CasedInput
        name="description"
        aria-label="Description"
        placeholder="Description"
        className="rounded border px-2 py-1"
      />
      <NumericInput
        name="days_due"
        inputMode="numeric"
        aria-label="Days due"
        placeholder="Days due"
        className="w-24 rounded border px-2 py-1"
      />
      <Btn type="submit">Add</Btn>
      {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
    </AddForm>
  );
}
