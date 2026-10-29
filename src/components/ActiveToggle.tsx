"use client";

import { useFormStatus } from "react-dom";
import { setIsActive } from "@/app/(app)/catalog-actions";
import { Busy } from "@/components/WorkingBeside";

type ActiveTable =
  | "products"
  | "customers"
  | "models"
  | "lots"
  | "brands"
  | "items"
  | "vendors"
  | "colors"
  | "patterns"
  | "contents"
  | "collections";

export function ActiveToggle({
  table,
  id,
  isActive,
}: {
  table: ActiveTable;
  id: string;
  isActive: boolean;
}) {
  return (
    <form action={setIsActive.bind(null, table, id)}>
      <input type="hidden" name="is_active" value={isActive ? "false" : "true"} />
      <ActiveSubmit label={isActive ? "Deactivate" : "Activate"} />
    </form>
  );
}

function ActiveSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Busy on={pending}>
      <button type="submit" disabled={pending} className="text-xs text-stone-600 underline disabled:opacity-50">
        {label}
      </button>
    </Busy>
  );
}
