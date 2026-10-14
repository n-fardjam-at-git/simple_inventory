"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { PriceInput } from "@/components/PriceInput";
import { NumericInput } from "@/components/NumericInput";
import { isNoDropAxis } from "@/lib/size-code";

export type MatrixSize = { id: string; code: string; sort_order: number };
export type MatrixDrop = { id: string; code: string; sort_order: number };

export type Cell = {
  size_id: string;
  drop_id: string;
  qty: number;
  upcharge?: number | null;
};

const CELL =
  "w-16 rounded border border-stone-300 bg-white px-1 py-0.5 text-center";
const CELL_COMPACT =
  "h-6 w-10 rounded border border-stone-300 bg-white px-0.5 text-center text-xs";

function blankZero(n: number) {
  return n === 0 ? "" : String(n);
}

function moveFocus(
  event: KeyboardEvent<HTMLInputElement>,
  colCount: number,
  rowCount: number,
) {
  const input = event.currentTarget;
  const col = Number(input.dataset.col);
  const row = Number(input.dataset.row);
  let nextCol = col;
  let nextRow = row;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    nextCol = col - 1;
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    nextCol = col + 1;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    nextRow = row - 1;
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    nextRow = row + 1;
  } else if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    nextCol = col - 1;
    if (nextCol < 0) {
      nextCol = colCount - 1;
      nextRow = row - 1;
    }
  } else if (event.key === "Enter") {
    event.preventDefault();
    nextCol = col + 1;
    if (nextCol >= colCount) {
      nextCol = 0;
      nextRow = row + 1;
    }
  } else {
    return;
  }

  if (nextCol < 0 || nextRow < 0 || nextCol >= colCount || nextRow >= rowCount) {
    return;
  }
  const grid = input.closest("[data-matrix-grid]");
  const next = grid?.querySelector<HTMLInputElement>(
    `input[data-col="${nextCol}"][data-row="${nextRow}"]`,
  );
  next?.focus();
  next?.select();
}

function MoneyCell({
  name,
  defaultValue,
  col,
  row,
  colCount,
  rowCount,
  ariaLabel,
}: {
  name: string;
  defaultValue: string;
  col: number;
  row: number;
  colCount: number;
  rowCount: number;
  ariaLabel: string;
}) {
  return (
    <PriceInput
      name={name}
      defaultValue={defaultValue}
      blankZero
      data-col={col}
      data-row={row}
      aria-label={ariaLabel}
      className="w-16 rounded border border-stone-400 bg-white px-1 py-0.5 text-right font-medium tabular-nums text-stone-900"
      onKeyDown={(e) => moveFocus(e, colCount, rowCount)}
    />
  );
}

export function QtyMatrix({
  sizes,
  drops,
  cells,
  editable = false,
  namePrefix,
  compact = false,
  showTotals = false,
}: {
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
  editable?: boolean;
  namePrefix?: string;
  compact?: boolean;
  showTotals?: boolean;
}) {
  const sortedSizes = [...sizes].sort((a, b) => a.sort_order - b.sort_order);
  const sortedDrops = [...drops].sort((a, b) => a.sort_order - b.sort_order);
  const hideDrop = isNoDropAxis(sortedDrops);
  const lookup = new Map(cells.map((c) => [`${c.size_id}:${c.drop_id}`, c]));
  const pad = compact ? "px-1 py-0" : "px-2 py-1";
  const sizePad = compact ? "px-1.5 py-0" : "px-3 py-1";
  const prefix = namePrefix ?? "cell";

  const initialQty = () => {
    const map: Record<string, number> = {};
    for (const d of sortedDrops) {
      for (const s of sortedSizes) {
        map[`${s.id}:${d.id}`] = lookup.get(`${s.id}:${d.id}`)?.qty ?? 0;
      }
    }
    return map;
  };
  const [qtyMap, setQtyMap] = useState(initialQty);

  function qtyAt(sizeId: string, dropId: string) {
    if (editable) return Number(qtyMap[`${sizeId}:${dropId}`] ?? 0);
    return Number(lookup.get(`${sizeId}:${dropId}`)?.qty ?? 0);
  }

  function dropTotal(dropId: string) {
    return sortedSizes.reduce((sum, s) => sum + qtyAt(s.id, dropId), 0);
  }

  const grandTotal = sortedDrops.reduce((sum, d) => sum + dropTotal(d.id), 0);

  function onGridInput(e: FormEvent<HTMLDivElement>) {
    const t = e.target as HTMLInputElement;
    if (!t.name?.startsWith(prefix + ":")) return;
    const parts = t.name.split(":");
    if (parts.length < 3) return;
    setQtyMap((prev) => ({ ...prev, [`${parts[1]}:${parts[2]}`]: Number(t.value) || 0 }));
  }

  return (
    <div
      className={`${showTotals ? "flex w-full" : "inline-flex"} items-end gap-1 overflow-x-auto`}
      data-matrix-grid={editable ? "" : undefined}
      onInput={showTotals && editable ? onGridInput : undefined}
    >
      <table
        className={`min-w-0 border-collapse bg-white ${showTotals ? "w-full table-fixed" : ""} ${compact ? "text-xs" : "text-sm"}`}
      >
        <thead>
          <tr>
            {hideDrop ? null : (
              <th
                className={`${showTotals ? "w-12" : "whitespace-nowrap"} border border-stone-200 bg-stone-100 ${pad} text-left`}
              >
                {compact ? "Drop" : "Drop \\ Size"}
              </th>
            )}
            {sortedSizes.map((s) => (
              <th key={s.id} className={`border border-stone-200 bg-stone-100 ${sizePad} text-center`}>
                {s.code}
              </th>
            ))}
            {showTotals ? (
              <th className={`w-12 border border-stone-200 bg-stone-100 ${pad} text-center font-medium`}>
                total
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {sortedDrops.map((d, row) => {
            const rowSum = dropTotal(d.id);
            return (
            <tr key={d.id}>
              {hideDrop ? null : (
                <th className={`border border-stone-200 bg-stone-50 ${pad} text-left font-medium`}>
                  {d.code}
                </th>
              )}
              {sortedSizes.map((s, col) => {
                const cell = lookup.get(`${s.id}:${d.id}`);
                const qty = cell?.qty ?? 0;
                const up = cell?.upcharge ?? 0;
                return (
                  <td
                    key={s.id}
                    className={`border border-stone-200 bg-white ${pad} text-center`}
                  >
                    {editable ? (
                      <NumericInput
                        className={compact ? CELL_COMPACT : CELL}
                        inputMode="numeric"
                        name={`${prefix}:${s.id}:${d.id}`}
                        defaultValue={blankZero(qty)}
                        data-col={col}
                        data-row={row}
                        aria-label={hideDrop ? s.code : `${d.code} ${s.code}`}
                        onKeyDown={(e) =>
                          moveFocus(e, sortedSizes.length, sortedDrops.length)
                        }
                      />
                    ) : qty === 0 && !(up > 0) ? (
                      <span className="text-stone-300">&nbsp;</span>
                    ) : (
                      <span className="inline-flex items-start justify-center gap-0.5">
                        <span className="font-medium">{qty === 0 ? "" : qty}</span>
                        {up > 0 ? (
                          <sup className="text-[10px] font-semibold leading-none text-amber-700">
                            +${up}
                          </sup>
                        ) : null}
                      </span>
                    )}
                  </td>
                );
              })}
              {showTotals ? (
                <td
                  className={`border border-stone-200 bg-stone-50 ${pad} text-center font-medium tabular-nums`}
                >
                  {rowSum === 0 ? "" : rowSum}
                </td>
              ) : null}
            </tr>
            );
          })}
        </tbody>
      </table>
      {showTotals ? (
        <span
          className={`inline-flex w-12 shrink-0 items-center justify-center border border-stone-200 bg-stone-50 font-semibold tabular-nums ${pad} ${compact ? "text-xs" : "text-sm"}`}
        >
          {grandTotal === 0 ? "" : grandTotal}
        </span>
      ) : null}
    </div>
  );
}

export function UpchargeMatrix({
  sizes,
  drops,
  cells,
}: {
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
}) {
  const sortedSizes = [...sizes].sort((a, b) => a.sort_order - b.sort_order);
  const sortedDrops = [...drops].sort((a, b) => a.sort_order - b.sort_order);
  const hideDrop = isNoDropAxis(sortedDrops);
  const lookup = new Map(cells.map((c) => [`${c.size_id}:${c.drop_id}`, c]));
  return (
    <div className="overflow-x-auto" data-matrix-grid="">
      <table className="border-collapse bg-white text-sm">
        <thead>
          <tr>
            <th className="border border-teal-300 bg-teal-100 px-2 py-1 text-left font-medium text-teal-900">
              $ extra
            </th>
            {sortedSizes.map((s) => (
              <th key={s.id} className="border border-teal-300 bg-teal-100 px-3 py-1 text-center text-teal-900">
                {s.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedDrops.map((d, row) => (
            <tr key={d.id}>
              <th className="border border-teal-300 bg-teal-50 px-2 py-1 text-left text-teal-900">
                {hideDrop ? "" : d.code}
              </th>
              {sortedSizes.map((s, col) => {
                const cell = lookup.get(`${s.id}:${d.id}`);
                const up = cell?.upcharge ?? 0;
                return (
                  <td key={s.id} className="border border-stone-400 bg-white px-1 py-1 text-right">
                    <MoneyCell
                      name={`up:${s.id}:${d.id}`}
                      defaultValue={blankZero(up)}
                      col={col}
                      row={row}
                      colCount={sortedSizes.length}
                      rowCount={sortedDrops.length}
                      ariaLabel={hideDrop ? `Upcharge ${s.code}` : `Upcharge ${d.code} ${s.code}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
