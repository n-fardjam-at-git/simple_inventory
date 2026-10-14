"use client";

import { useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { SEASON_PERIODS, periodValue, type SeasonRow } from "@/lib/season";
import { deleteSeason, updateSeason } from "./actions";
import { NumericInput } from "@/components/NumericInput";

export function SeasonsTable({ rows }: { rows: SeasonRow[] }) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Season</th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <SeasonRowView row={r} />}
    />
  );
}

function SeasonRowView({ row }: { row: SeasonRow }) {
  const [period, setPeriod] = useState(periodValue(row.start_season, row.is_combo));
  const [year, setYear] = useState(String(row.year));
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const snapshot = {
    period: periodValue(row.start_season, row.is_combo),
    year: String(row.year),
  };
  const dirty = period !== snapshot.period || year !== snapshot.year;

  const list = useList();
  function persist() {
    return new Promise<boolean>((resolve) => {
      start(async () => {
        const message = await updateSeason(row.id, period, Number(year));
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
      setPeriod(snapshot.period);
      setYear(snapshot.year);
      setErr(null);
    },
    save: persist,
  });

  return (
    <SelectableRow id={row.id}>
      <td className="py-1.5">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded border px-1 py-0.5"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {SEASON_PERIODS.map((p) => (
                <option key={periodValue(p.start, p.combo)} value={periodValue(p.start, p.combo)}>
                  {p.label}
                </option>
              ))}
            </select>
            <NumericInput
              className="w-16 rounded border px-1 py-0.5"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            />
          </div>
        ) : (
          row.season
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
            if (!confirm(`Delete ${row.season}?`)) return;
            start(async () => {
              const message = await deleteSeason(row.id);
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
