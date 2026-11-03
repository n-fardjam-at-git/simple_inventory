"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ComboBox } from "@/components/ComboBox";
import { NumericInput } from "@/components/NumericInput";
import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { isNoDropAxis, visibleDrops } from "@/lib/size-code";

const CELL =
  "h-6 w-full min-w-0 rounded border border-stone-300 bg-white px-0 text-center text-xs focus:outline-none focus:ring-2 focus:ring-teal-700";
const DROP_CELL =
  "h-6 w-full rounded border border-stone-300 bg-white px-0.5 py-0 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700";
const PAD = "px-0.5 py-0";
const SIZE_PAD = "px-0 py-0";

type DropRow = { key: string; dropId: string };

function blankZero(n: number) {
  return n === 0 ? "" : String(n);
}

function displayQty(n: number) {
  if (!Number.isFinite(n) || n === 0) return "";
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function moveFocus(
  event: KeyboardEvent<HTMLInputElement>,
  colCount: number,
  rowCount: number,
  onLastDown?: () => boolean,
) {
  const input = event.currentTarget;
  const col = Number(input.dataset.col);
  const row = Number(input.dataset.row);
  let nextCol = col;
  let nextRow = row;
  let dCol = 0;
  let dRow = 0;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    nextCol = col - 1;
    dCol = -1;
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    nextCol = col + 1;
    dCol = 1;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    nextRow = row - 1;
    dRow = -1;
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (row >= rowCount - 1 && onLastDown?.()) return;
    nextRow = row + 1;
    dRow = 1;
  } else if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    nextCol = col - 1;
    dCol = -1;
    if (nextCol < 0) {
      nextCol = colCount - 1;
      nextRow = row - 1;
      dRow = -1;
    }
  } else if (event.key === "Enter") {
    event.preventDefault();
    nextCol = col + 1;
    dCol = 1;
    if (nextCol >= colCount) {
      nextCol = 0;
      nextRow = row + 1;
      dRow = 1;
    }
  } else {
    return;
  }

  const grid = input.closest("[data-matrix-grid]");
  function focusAt(c: number, r: number) {
    const next = grid?.querySelector<HTMLInputElement>(
      `input[data-col="${c}"][data-row="${r}"]:not([type="hidden"])`,
    );
    if (!next) return false;
    next.focus();
    next.select();
    return true;
  }
  for (let i = 0; i < rowCount * colCount; i++) {
    if (nextCol < 0 || nextRow < 0 || nextCol >= colCount || nextRow >= rowCount) return;
    if (focusAt(nextCol, nextRow)) return;
    if (dRow) nextRow += dRow;
    else if (dCol) nextCol += dCol;
    else return;
  }
  if ((event.key === "Enter" && !event.shiftKey) || event.key === "ArrowRight") {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    requestAnimationFrame(() => focusAt(col + 1, row));
  }
}

function usedDropIds(rows: DropRow[]) {
  return new Set(rows.map((r) => r.dropId).filter(Boolean));
}

function seedRows(drops: MatrixDrop[], cells: Cell[], qtyOnly = false): DropRow[] {
  if (isNoDropAxis(drops)) {
    return [{ key: drops[0]?.id ?? "none", dropId: drops[0]?.id ?? "" }];
  }
  const named = visibleDrops([...drops].sort((a, b) => a.sort_order - b.sort_order));
  const have = new Set(
    cells.filter((cell) => !qtyOnly || Number(cell.qty) > 0).map((cell) => cell.drop_id),
  );
  const chosen = named.filter((d) => have.has(d.id));
  if (!chosen.length) return [{ key: "blank", dropId: "" }];
  return chosen.map((d) => ({ key: d.id, dropId: d.id }));
}

export function CuttingDropQtyGrid({
  sizes,
  drops,
  cells,
  editable = false,
  namePrefix = "ord",
  onDirty,
  qtyOnly = false,
}: {
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
  editable?: boolean;
  namePrefix?: string;
  onDirty?: () => void;
  /** Seed a row only when that drop has a quantity. Otherwise start with one blank row. */
  qtyOnly?: boolean;
}) {
  const sortedSizes = [...sizes].sort((a, b) => a.sort_order - b.sort_order);
  const hideDrop = isNoDropAxis(drops);
  const namedDrops = hideDrop
    ? []
    : visibleDrops([...drops].sort((a, b) => a.sort_order - b.sort_order));
  const lookup = new Map(cells.map((c) => [`${c.size_id}:${c.drop_id}`, c.qty]));
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusDropKey, setFocusDropKey] = useState<string | null>(null);
  const [rows, setRows] = useState<DropRow[]>(() => seedRows(drops, cells, qtyOnly));
  const [qtyMap, setQtyMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const c of cells) map[`${c.size_id}:${c.drop_id}`] = Number(c.qty ?? 0);
    return map;
  });

  const shownRows = editable ? rows : seedRows(drops, cells, qtyOnly);

  function qtyAt(sizeId: string, dropId: string) {
    if (!dropId) return 0;
    const k = `${sizeId}:${dropId}`;
    if (editable && k in qtyMap) return Number(qtyMap[k] ?? 0);
    return Number(lookup.get(k) ?? 0);
  }

  function markDirty() {
    onDirty?.();
  }

  function setDrop(key: string, dropId: string) {
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, dropId } : r)));
    markDirty();
  }

  function rowHasQty(row: DropRow) {
    if (!row.dropId) return false;
    return sortedSizes.some((s) => qtyAt(s.id, row.dropId) > 0);
  }

  function addRow() {
    const last = rows[rows.length - 1];
    if (!last?.dropId || !rowHasQty(last)) return;
    if (namedDrops.every((d) => usedDropIds(rows).has(d.id))) return;
    const added = `n${rows.length}-${Date.now()}`;
    setRows((cur) => [...cur, { key: added, dropId: "" }]);
    setFocusDropKey(added);
    markDirty();
  }

  useLayoutEffect(() => {
    if (!focusDropKey) return;
    const key = focusDropKey;
    const find = () =>
      gridRef.current?.querySelector<HTMLInputElement>(
        `[data-drop-key="${key}"] input:not([type="hidden"])`,
      );
    find()?.focus();
    const raf = requestAnimationFrame(() => {
      find()?.focus();
      setFocusDropKey((cur) => (cur === key ? null : cur));
    });
    return () => cancelAnimationFrame(raf);
  }, [focusDropKey, rows]);

  function removeRow(key: string) {
    setRows((cur) => {
      const next = cur.filter((r) => r.key !== key);
      return next.length ? next : [{ key: "blank", dropId: "" }];
    });
    markDirty();
  }

  function optionsFor(row: DropRow) {
    const used = usedDropIds(rows);
    return namedDrops
      .filter((d) => d.id === row.dropId || !used.has(d.id))
      .map((d) => ({ id: d.id, label: d.code }));
  }

  const last = rows[rows.length - 1];
  const canAdd =
    editable &&
    !hideDrop &&
    Boolean(last?.dropId) &&
    Boolean(last && rowHasQty(last)) &&
    namedDrops.some((d) => !usedDropIds(rows).has(d.id));

  const dropCol = hideDrop ? 0 : 1;
  const colCount = sortedSizes.length + dropCol;

  function onGridKey(e: KeyboardEvent<HTMLInputElement>) {
    const fromCol = Number(e.currentTarget.dataset.col);
    moveFocus(e, colCount, rows.length, () => {
      if (fromCol < dropCol) return false;
      if (!canAdd) return false;
      addRow();
      return true;
    });
  }

  const grandTotal = shownRows.reduce((sum, r) => {
    if (!r.dropId) return sum;
    return sum + sortedSizes.reduce((s, size) => s + qtyAt(size.id, r.dropId), 0);
  }, 0);

  return (
    <div
      ref={gridRef}
      className="flex w-full min-w-0 items-end gap-1 overflow-x-auto"
      data-matrix-grid={editable ? "" : undefined}
      onInput={(e) => {
        const t = e.target as HTMLInputElement;
        if (!t.name?.startsWith(namePrefix + ":")) return;
        const parts = t.name.split(":");
        if (parts.length < 3) return;
        setQtyMap((prev) => ({ ...prev, [`${parts[1]}:${parts[2]}`]: Number(t.value) || 0 }));
      }}
    >
      <table className="min-w-0 w-full flex-1 table-fixed border-collapse bg-white text-xs">
        <thead>
          <tr>
            {hideDrop ? null : (
              <th className={`w-16 border border-stone-200 bg-stone-100 ${PAD} text-left`}>Drop</th>
            )}
            {sortedSizes.map((s) => (
              <th key={s.id} className={`min-w-8 border border-stone-200 bg-stone-100 ${SIZE_PAD} text-center`}>
                {s.code}
              </th>
            ))}
            <th className={`w-12 border border-stone-200 bg-stone-100 ${PAD} text-center font-medium`}>
              total
            </th>
            {editable && !hideDrop ? (
              <th className={`w-10 border border-stone-200 bg-stone-100 ${PAD}`} />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {shownRows.map((row, rowIndex) => {
            const rowSum = row.dropId
              ? sortedSizes.reduce((s, size) => s + qtyAt(size.id, row.dropId), 0)
              : 0;
            const drop = namedDrops.find((d) => d.id === row.dropId);
            return (
              <tr key={row.key}>
                {hideDrop ? null : (
                  <th
                    data-drop-key={row.key}
                    className={`border border-stone-200 bg-stone-50 ${PAD} text-left font-medium focus-within:bg-teal-50`}
                  >
                    {row.dropId ? (
                      <input type="hidden" name={`keepDrop:${row.dropId}`} value={row.dropId} />
                    ) : null}
                    {editable ? (
                      <ComboBox
                        allowEmpty
                        autoFocus={row.key === focusDropKey}
                        className={DROP_CELL}
                        placeholder="Drop"
                        value={row.dropId}
                        data-col={0}
                        data-row={rowIndex}
                        aria-label="Drop"
                        onKeyDown={onGridKey}
                        onChange={(id) => setDrop(row.key, id)}
                        options={optionsFor(row)}
                      />
                    ) : (
                      drop?.code ?? ""
                    )}
                  </th>
                )}
                {sortedSizes.map((s, col) => {
                  const qty = qtyAt(s.id, row.dropId);
                  const up = Number(
                    cells.find((cell) => cell.size_id === s.id && cell.drop_id === row.dropId)?.upcharge ??
                      0,
                  );
                  return (
                    <td key={s.id} className="min-w-8 border border-stone-200 bg-white p-0 text-center">
                      {hideDrop && col === 0 && row.dropId ? (
                        <input type="hidden" name={`keepDrop:${row.dropId}`} value={row.dropId} />
                      ) : null}
                      {editable && row.dropId ? (
                        <span className="inline-flex items-start justify-center gap-0.5">
                          <NumericInput
                            className={CELL}
                            inputMode="numeric"
                            name={`${namePrefix}:${s.id}:${row.dropId}`}
                            defaultValue={blankZero(qty)}
                            data-col={col + dropCol}
                            data-row={rowIndex}
                            aria-label={`${drop?.code ?? "Drop"} ${s.code}`}
                            onKeyDown={onGridKey}
                          />
                          {up > 0 ? (
                            <sup className="text-[10px] font-semibold leading-none text-amber-700">
                              +${up}
                            </sup>
                          ) : null}
                        </span>
                      ) : qty === 0 && !(up > 0) ? (
                        <span className="text-stone-300">&nbsp;</span>
                      ) : (
                        <span className="inline-flex items-start justify-center gap-0.5">
                          <span className="font-medium">{qty === 0 ? "" : displayQty(qty)}</span>
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
                <td
                  className={`overflow-hidden border border-stone-200 bg-stone-50 ${PAD} text-center font-medium tabular-nums`}
                >
                  {displayQty(rowSum)}
                </td>
                {editable && !hideDrop ? (
                  <td className={`border border-stone-200 bg-white ${PAD} text-center`}>
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        className="px-0.5 text-sm leading-none text-stone-400 hover:text-stone-700"
                        aria-label="Remove drop row"
                        onClick={() => removeRow(row.key)}
                      >
                        ×
                      </button>
                      {rowIndex === rows.length - 1 && canAdd ? (
                        <button
                          type="button"
                          className="px-0.5 text-sm leading-none text-stone-400 hover:text-stone-700"
                          aria-label="Add drop row"
                          title="Add drop"
                          onClick={addRow}
                        >
                          ↓
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      <span
        className={`inline-flex w-12 shrink-0 items-center justify-center overflow-hidden border border-stone-200 bg-stone-50 font-semibold tabular-nums ${PAD} text-xs`}
      >
        {displayQty(grandTotal)}
      </span>
    </div>
  );
}
