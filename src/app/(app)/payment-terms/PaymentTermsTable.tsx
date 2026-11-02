"use client";

import { useState, useTransition } from "react";
import { DismissNote } from "@/components/DismissNote";
import { NumericInput } from "@/components/NumericInput";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { toSentenceCase } from "@/lib/text-case";
import { deletePaymentTerm, updatePaymentTerm } from "./actions";

export type PaymentTermRow = {
  id: string;
  term: string;
  description: string | null;
  days_due: number | null;
};

export function PaymentTermsTable({ rows }: { rows: PaymentTermRow[] }) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Term</th>
            <th>Description</th>
            <th>Days due</th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <TermRow row={r} />}
    />
  );
}

function TermRow({ row }: { row: PaymentTermRow }) {
  const [term, setTerm] = useState(row.term);
  const [description, setDescription] = useState(row.description ?? "");
  const [days, setDays] = useState(row.days_due == null ? "" : String(row.days_due));
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "save" | "delete">(null);
  const [err, setErr] = useState<string | null>(null);
  const list = useList();
  const savedDays = row.days_due == null ? "" : String(row.days_due);
  const dirty = term !== row.term || description !== (row.description ?? "") || days !== savedDays;

  function persist() {
    return new Promise<boolean>((resolve) => {
      setJob("save");
      start(async () => {
        try {
          const message = await updatePaymentTerm(row.id, { term, description, daysDue: days });
          if (message) {
            setErr(message);
            resolve(false);
          } else {
            setErr(null);
            list.finishEdit(row.id);
            resolve(true);
          }
        } finally {
          setJob(null);
        }
      });
    });
  }

  const { editing, requestEdit, requestCancel } = useListRow(row.id, {
    dirty,
    revert: () => {
      setTerm(row.term);
      setDescription(row.description ?? "");
      setDays(savedDays);
      setErr(null);
    },
    save: persist,
  });

  return (
    <SelectableRow id={row.id}>
      <td className="py-1.5">
        {editing ? (
          <input
            className="rounded border px-1 py-0.5"
            value={term}
            aria-label="Term"
            onChange={(e) => setTerm(e.target.value)}
          />
        ) : (
          row.term
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="w-full rounded border px-1 py-0.5"
            value={description}
            aria-label="Description"
            onChange={(e) => setDescription(toSentenceCase(e.target.value))}
          />
        ) : (
          (row.description ?? "")
        )}
      </td>
      <td>
        {editing ? (
          <NumericInput
            className="w-16 rounded border px-1 py-0.5"
            inputMode="numeric"
            aria-label="Days due"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))}
          />
        ) : (
          <span className="tabular-nums">{row.days_due ?? ""}</span>
        )}
      </td>
      <td className="py-1">
        <RowButtons
          editing={editing}
          dirty={dirty}
          saving={job === "save"}
          deleting={job === "delete"}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={() => {
            if (!confirm(`Delete ${row.term}?`)) return;
            setJob("delete");
            start(async () => {
              try {
                const message = await deletePaymentTerm(row.id);
                if (message) setErr(message);
              } finally {
                setJob(null);
              }
            });
          }}
        />
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
    </SelectableRow>
  );
}
