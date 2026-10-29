"use client";

import { DismissNote } from "@/components/DismissNote";
import { useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { toSentenceCase } from "@/lib/text-case";
import { deleteVendor, updateVendor } from "./actions";

export type VendorRow = {
  id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
};

export function VendorsTable({ rows, canEdit }: { rows: VendorRow[]; canEdit: boolean }) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Vendor</th>
            <th>Notes</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <VendorEditRow row={r} canEdit={canEdit} />}
    />
  );
}

function VendorEditRow({ row, canEdit }: { row: VendorRow; canEdit: boolean }) {
  const [name, setName] = useState(row.name);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [active, setActive] = useState(row.is_active);
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "save" | "delete">(null);
  const [err, setErr] = useState<string | null>(null);
  const list = useList();

  const dirty =
    name !== row.name || notes !== (row.notes ?? "") || active !== row.is_active;

  function persist() {
    return new Promise<boolean>((resolve) => {
      setJob("save");
      start(async () => {
        try {
          const message = await updateVendor(row.id, {
            name,
            notes,
            is_active: active,
          });
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
      setName(row.name);
      setNotes(row.notes ?? "");
      setActive(row.is_active);
      setErr(null);
    },
    save: persist,
  });

  return (
    <SelectableRow id={row.id} dimmed={!row.is_active}>
      <td className="py-1.5">
        {editing ? (
          <input
            className="rounded border px-1 py-0.5"
            value={name}
            aria-label="Vendor name"
            onChange={(e) => setName(toSentenceCase(e.target.value))}
          />
        ) : (
          row.name
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="w-full rounded border px-1 py-0.5"
            value={notes}
            aria-label="Notes"
            onChange={(e) => setNotes(toSentenceCase(e.target.value))}
          />
        ) : (
          row.notes ?? ""
        )}
      </td>
      <td>
        {editing ? (
          <label className="text-xs">
            <input
              type="checkbox"
              className="mr-1"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
        ) : row.is_active ? (
          "Active"
        ) : (
          "Inactive"
        )}
      </td>
      <td className="py-1">
        {canEdit ? (
          <RowButtons
            editing={editing}
            dirty={dirty}
            saving={job === "save"}
            deleting={job === "delete"}
            onEdit={requestEdit}
            onSave={() => void persist()}
            onCancel={requestCancel}
            onDelete={() => {
              if (!confirm(`Delete ${row.name}?`)) return;
              setJob("delete");
              start(async () => {
                try {
                  const message = await deleteVendor(row.id);
                  if (message) setErr(message);
                } finally {
                  setJob(null);
                }
              });
            }}
          />
        ) : null}
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
    </SelectableRow>
  );
}
