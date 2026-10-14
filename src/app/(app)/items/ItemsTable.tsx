"use client";

import { useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { deleteItem, updateItem } from "./actions";
import { toSentenceCase } from "@/lib/text-case";
import { ComboBox } from "@/components/ComboBox";

type Chart = { id: string; name: string };
type Row = {
  id: string;
  name: string;
  is_active: boolean;
  in_set: boolean;
  default_size_chart_id: string | null;
  size_charts: { name: string } | null;
};

export function ItemsTable({ rows, charts }: { rows: Row[]; charts: Chart[] }) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Item</th>
            <th>Default chart</th>
            <th>In set</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
      }
      stretch
      renderRow={(r) => <ItemRow row={r} charts={charts} />}
    />
  );
}

function ItemRow({ row, charts }: { row: Row; charts: Chart[] }) {
  const [name, setName] = useState(row.name);
  const [chartId, setChartId] = useState(row.default_size_chart_id ?? "");
  const [active, setActive] = useState(row.is_active);
  const [inSet, setInSet] = useState(row.in_set);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const snapshot = {
    name: row.name,
    chartId: row.default_size_chart_id ?? "",
    active: row.is_active,
    inSet: row.in_set,
  };
  const dirty =
    name !== snapshot.name ||
    chartId !== snapshot.chartId ||
    active !== snapshot.active ||
    inSet !== snapshot.inSet;

  const list = useList();
  function persist() {
    return new Promise<boolean>((resolve) => {
      start(async () => {
        const message = await updateItem(row.id, {
          name,
          default_size_chart_id: chartId || null,
          is_active: active,
          in_set: inSet,
        });
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
      setChartId(snapshot.chartId);
      setActive(snapshot.active);
      setInSet(snapshot.inSet);
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
            onChange={(e) => setName(toSentenceCase(e.target.value))}
          />
        ) : (
          row.name
        )}
      </td>
      <td>
        {editing ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            allowEmpty
            placeholder="Default chart"
            value={chartId}
            onChange={setChartId}
            options={charts.map((c) => ({ id: c.id, label: c.name }))}
          />
        ) : (
          row.size_charts?.name ?? "—"
        )}
      </td>
      <td>
        {editing ? (
          <label className="text-xs">
            <input
              type="checkbox"
              className="mr-1"
              checked={inSet}
              onChange={(e) => setInSet(e.target.checked)}
            />
            In set
          </label>
        ) : row.in_set ? (
          "Yes"
        ) : (
          ""
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
        <RowButtons
          editing={editing}
          dirty={dirty}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={() => {
            if (!confirm(`Delete ${row.name}?`)) return;
            start(async () => {
              const message = await deleteItem(row.id);
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
