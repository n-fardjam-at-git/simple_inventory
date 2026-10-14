"use client";

import { useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { deleteChart, updateChart } from "./actions";
import { asTypedSizeList } from "@/lib/size-code";
import { toSentenceCase } from "@/lib/text-case";
import { SizeChartPreview } from "./SizeChartPreview";

type Row = { id: string; name: string; sizes: string; drops: string };

export function SizeChartsTable({ rows }: { rows: Row[] }) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Chart</th>
            <th>Sizes</th>
            <th>Drops</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <ChartRow row={r} />}
    />
  );
}

function ChartRow({ row }: { row: Row }) {
  const [name, setName] = useState(row.name);
  const [sizes, setSizes] = useState(row.sizes);
  const [drops, setDrops] = useState(row.drops);
  const [preview, setPreview] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const snapshot = { name: row.name, sizes: row.sizes, drops: row.drops };
  const dirty =
    name !== snapshot.name || sizes !== snapshot.sizes || drops !== snapshot.drops;

  const list = useList();
  function persist() {
    return new Promise<boolean>((resolve) => {
      start(async () => {
        const message = await updateChart(row.id, { name, sizes, drops });
        if (message) {
          setErr(message);
          resolve(false);
        } else {
          setErr(null);
          list.finishEdit(row.id);
          resolve(true);
        }
      });
    });
  }
  const { editing, requestEdit, requestCancel } = useListRow(row.id, {
    dirty,
    revert: () => {
      setName(snapshot.name);
      setSizes(snapshot.sizes);
      setDrops(snapshot.drops);
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
            value={name}
            onChange={(e) => setName(toSentenceCase(e.target.value))}
          />
        ) : (
          row.name
        )}
      </td>
      <td className="font-mono text-xs">
        {editing ? (
          <input
            className="w-full min-w-40 rounded border px-1 py-0.5 font-mono"
            value={sizes}
            onChange={(e) => setSizes(asTypedSizeList(e.target.value))}
          />
        ) : (
          row.sizes || "—"
        )}
      </td>
      <td className="font-mono text-xs">
        {editing ? (
          <input
            className="w-full min-w-40 rounded border px-1 py-0.5 font-mono"
            value={drops}
            onChange={(e) => setDrops(e.target.value)}
          />
        ) : (
          row.drops || "—"
        )}
      </td>
      <td>
        <button
          type="button"
          className="text-xs text-stone-700 underline"
          onClick={() => setPreview(true)}
        >
          Chart
        </button>
        {preview ? (
          <SizeChartPreview
            title={editing ? name : row.name}
            sizes={editing ? sizes : row.sizes}
            drops={editing ? drops : row.drops}
            onClose={() => setPreview(false)}
          />
        ) : null}
      </td>
      <td className="py-1">
        <RowButtons
          editing={editing}
          dirty={dirty}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={() => {
            if (!confirm(`Delete ${row.name}?`)) return;
            start(async () => {
              const message = await deleteChart(row.id);
              if (message) setErr(message);
            });
          }}
        />
        {err ? <p className="text-xs text-red-700">{err}</p> : null}
        {pending ? <p className="text-xs text-stone-400">Working…</p> : null}
      </td>
    </SelectableRow>
  );
}
