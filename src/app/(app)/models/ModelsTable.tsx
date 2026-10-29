"use client";

import { DismissNote } from "@/components/DismissNote";
import { useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { deleteModel, updateModel } from "@/app/(app)/models-actions";
import { toBrandCase } from "@/lib/text-case";
import { ComboBox } from "@/components/ComboBox";
import { NumericInput } from "@/components/NumericInput";

type Opt = { id: string; name: string };

type ModelRowData = {
  id: string;
  name: string;
  is_active: boolean;
  item_id: string;
  size_chart_id: string;
  average_consumption: number | null;
  items: { name: string } | null;
  size_charts: { name: string } | null;
};

function consumptionText(n: number | null) {
  return n == null ? "" : Number(n).toFixed(2);
}

export function ModelsTable({
  rows,
  items,
  charts,
}: {
  rows: ModelRowData[];
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
            <th>Avg consumption</th>
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
  row: ModelRowData;
  items: Opt[];
  charts: Opt[];
}) {
  const [name, setName] = useState(row.name);
  const [itemId, setItemId] = useState(row.item_id);
  const [chartId, setChartId] = useState(row.size_chart_id);
  const [consumption, setConsumption] = useState(consumptionText(row.average_consumption));
  const [active, setActive] = useState(row.is_active);
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "save" | "delete">(null);
  const [err, setErr] = useState<string | null>(null);

  const snapshot = {
    name: row.name,
    itemId: row.item_id,
    chartId: row.size_chart_id,
    consumption: consumptionText(row.average_consumption),
    active: row.is_active,
  };
  const dirty =
    name !== snapshot.name ||
    itemId !== snapshot.itemId ||
    chartId !== snapshot.chartId ||
    consumption !== snapshot.consumption ||
    active !== snapshot.active;

  const list = useList();
  function persist() {
    return new Promise<boolean>((resolve) => {
      setJob("save");
      start(async () => {
        try {
          const message = await updateModel(row.id, {
            name,
            item_id: itemId,
            size_chart_id: chartId,
            is_active: active,
            average_consumption: consumption,
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
      setName(snapshot.name);
      setItemId(snapshot.itemId);
      setChartId(snapshot.chartId);
      setConsumption(snapshot.consumption);
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
      <td className="tabular-nums">
        {editing ? (
          <NumericInput
            decimal
            className="w-20 rounded border px-1 py-0.5"
            aria-label="Avg consumption"
            value={consumption}
            onChange={(e) => setConsumption(e.target.value)}
          />
        ) : (
          consumptionText(row.average_consumption)
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
          saving={job === "save"}
          deleting={job === "delete"}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={() => {
            if (!confirm(`Delete model ${row.name}?`)) return;
            setJob("delete");
            start(async () => {
              try {
                const message = await deleteModel(row.id);
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
