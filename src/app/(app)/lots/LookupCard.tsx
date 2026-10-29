"use client";

import { Card, Btn } from "@/components/ui";
import { insertNamed } from "@/app/(app)/catalog-actions";
import { ActiveToggle } from "@/components/ActiveToggle";
import { CasedInput } from "@/components/CasedInput";
import { AddForm } from "@/components/AddForm";

export function LookupCard({
  title,
  table,
  rows,
  asTyped = false,
}: {
  title: string;
  table: "colors" | "patterns" | "contents";
  rows: { id: string; name: string; is_active: boolean }[];
  asTyped?: boolean;
}) {
  return (
    <Card>
      <h2 className="mb-2 font-medium">{title}</h2>
      <ul className="mb-3 max-h-40 overflow-y-auto text-sm">
        {rows.map((r) => (
          <li key={r.id} className={r.is_active ? "" : "text-stone-400"}>
            {r.name}
            <span className="ml-2 inline-block">
              <ActiveToggle table={table} id={r.id} isActive={r.is_active} />
            </span>
          </li>
        ))}
      </ul>
      <AddForm action={insertNamed.bind(null, table)} className="flex gap-2 text-sm">
        {asTyped ? (
          <input name="name" required aria-label={title} className="min-w-0 flex-1 rounded border px-2 py-1" />
        ) : (
          <CasedInput name="name" required aria-label={title} className="min-w-0 flex-1 rounded border px-2 py-1" />
        )}
        <Btn type="submit">Add</Btn>
      </AddForm>
    </Card>
  );
}
