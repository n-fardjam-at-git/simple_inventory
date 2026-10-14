"use client";

import { useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { deleteModel, updateModel } from "@/app/(app)/models-actions";
import { toBrandCase } from "@/lib/text-case";
import { ComboBox } from "@/components/ComboBox";

type Opt = { id: string; name: string };

export function ModelsTable({
  rows,
  items,
  charts,
}: {
  rows: {
    id: string;
    name: string;
    is_active: boolean;
    item_id: string;
    size_chart_id: string;
    items: { name: string } | null;
    size_charts: { name: string } | null;
  }[];
  items: Opt[];
  charts: Opt[];
}) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Model</th>
            <th>Item</th>
            <th>Chart</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <ModelRow row={r} items={items} charts={charts} />}
    />
  );
}

function ModelRow({
  row,
  items,
  charts,
}: {
  row: {
    id: string;
    name: string;
    is_active: boolean;
    item_id: string;
    size_chart_id: string;
    items: { name: string } | null;
    size_charts: { name: string } | null;
  };
  items: Opt[];
  charts: Opt[];
}) {
  const [name, setName] = useState(row.name);
  const [itemId, setItemId] = useState(row.item_id);
  const [chartId, setChartId] = useState(row.size_chart_id);
  const [active, setActive] = useState(row.is_active);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const snapshot = {
    name: row.name,
    itemId: row.item_id,
    chartId: row.size_chart_id,
    active: row.is_active,
  };
  const dirty =
    name !== snapshot.name ||
    itemId !== snapshot.itemId ||
    chartId !== snapshot.chartId ||
    active !== snapshot.active;

  const list = useList();
  function persist() {
    return new Promise<boolean>((resolve) => {
      start(async () => {
        const message = await updateModel(row.id, {
          name,
          item_id: itemId,
          size_chart_id: chartId,
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
      });
    });
  }
  const { editing, requestEdit, requestCancel } = useListRow(row.id, {
    dirty,
    revert: () => {
      setName(snapshot.name);
      setItemId(snapshot.itemId);
      setChartId(snapshot.chartId);
      setActive(snapshot.active);
      setErr(null);
    },
    save: persist,
  });

  return (
    <SelectableRow id={row.id} dimmed={!row.is_active}>
      <td className="py-1">
        {editing ? (
          <input
            className="rounded border px-1 py-0.5"
            value={name}
            onChange={(e) => setName(toBrandCase(e.target.value))}
          />
        ) : (
          row.name
        )}
      </td>
      <td>
        {editing ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            required
            value={itemId}
            onChange={setItemId}
            options={items.map((i) => ({ id: i.id, label: i.name }))}
          />
        ) : (
          row.items?.name
        )}
      </td>
      <td>
        {editing ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            required
            value={chartId}
            onChange={setChartId}
            options={charts.map((c) => ({ id: c.id, label: c.name }))}
          />
        ) : (
          row.size_charts?.name
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
      <td>
        <RowButtons
          editing={editing}
          dirty={dirty}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={() => {
            if (!confirm(`Delete model ${row.name}?`)) return;
            start(async () => {
              const message = await deleteModel(row.id);
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
