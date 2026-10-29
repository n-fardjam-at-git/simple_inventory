"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { useRefreshRow } from "@/components/list/useRefreshRow";
import { FitList } from "@/components/list/FitList";
import { NumericInput } from "@/components/NumericInput";
import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { CuttingDropQtyGrid } from "./CuttingDropQtyGrid";
import { deleteCuttingOrderProduct, saveCuttingOrderLine } from "./actions";

export type CuttingOrderProductRow = {
  cutting_order_id: string;
  product_id: string;
  status: boolean;
  instructions: string | null;
  bulk_order_qty: number | null;
  products: {
    type?: number | null;
    name?: string | null;
    lots?: { id?: string; lot_no?: string; brands?: { name?: string } | null } | null;
    models?: { name?: string; items?: { name?: string } | null } | null;
  } | null;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
  qty_received: number;
  brand_id: string | null;
  item_id: string | null;
  size_chart_id: string | null;
};

function lineKey(row: CuttingOrderProductRow) {
  return `${row.cutting_order_id}:${row.product_id}`;
}

function lineLabel(p: CuttingOrderProductRow["products"]) {
  return p?.models?.name?.trim() || p?.name?.trim() || "Product";
}

export function CuttingOrderProductsTable({
  rows,
  lotNo,
  scaleId,
  copyId,
  onScale,
  onCopy,
}: {
  rows: CuttingOrderProductRow[];
  lotNo?: string | null;
  scaleId?: string | null;
  copyId?: string | null;
  onScale?: (row: CuttingOrderProductRow) => void;
  onCopy?: (row: CuttingOrderProductRow) => void;
}) {
  const items = [...rows].sort((a, b) =>
    lineLabel(a.products).localeCompare(lineLabel(b.products), "en", { sensitivity: "base" }),
  );
  return (
    <FitList
      items={items}
      getKey={lineKey}
      stretch
      tableClassName="inventory-boards table-fixed"
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="w-52 py-1">
              Product
              {lotNo ? <span className="font-light text-stone-400"> • {lotNo}</span> : null}
            </th>
            <th className="w-full py-1"></th>
            <th className="w-32 py-1"></th>
          </tr>
        </thead>
      }
      renderRow={(r) => (
        <ProductLineRow
          row={r}
          scaleOpen={scaleId === lineKey(r)}
          copyOpen={copyId === lineKey(r)}
          onScale={onScale}
          onCopy={onCopy}
        />
      )}
    />
  );
}

function ProductLineRow({
  row,
  scaleOpen,
  copyOpen,
  onScale,
  onCopy,
}: {
  row: CuttingOrderProductRow;
  scaleOpen?: boolean;
  copyOpen?: boolean;
  onScale?: (row: CuttingOrderProductRow) => void;
  onCopy?: (row: CuttingOrderProductRow) => void;
}) {
  const [status, setStatus] = useState(row.status);
  const [instructions, setInstructions] = useState(row.instructions ?? "");
  const [bulkQty, setBulkQty] = useState(
    row.bulk_order_qty == null ? "" : String(row.bulk_order_qty),
  );
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const list = useList();
  const router = useRouter();
  const refreshRow = useRefreshRow(row);
  const title = lineLabel(row.products);
  const id = lineKey(row);
  const savedInstructions = row.instructions ?? "";
  const savedBulk = row.bulk_order_qty == null ? "" : String(row.bulk_order_qty);
  const dirty =
    status !== row.status ||
    instructions !== savedInstructions ||
    bulkQty !== savedBulk ||
    matrixDirty;
  const qtyOrdered = row.cells.reduce((sum, c) => sum + Number(c.qty ?? 0), 0);
  const viewInstructions = row.instructions?.trim() || null;

  function persist() {
    return new Promise<boolean>((resolve) => {
      if (busy.current) {
        resolve(false);
        return;
      }
      const form = formRef.current;
      const formData = form ? new FormData(form) : new FormData();
      busy.current = true;
      setSaving(true);
      void (async () => {
        try {
          const rawBulk = bulkQty.trim();
          const bulkOrderQty = rawBulk === "" ? null : Number(rawBulk);
          if (rawBulk !== "" && (!Number.isInteger(bulkOrderQty) || bulkOrderQty < 0)) {
            setErr("Bulk qty must be a whole number.");
            resolve(false);
            return;
          }
          const message = await saveCuttingOrderLine(
            row.cutting_order_id,
            row.product_id,
            status,
            formData,
            instructions,
            bulkOrderQty,
          );
          if (message) {
            setErr(message);
            resolve(false);
            return;
          }
          setErr(null);
          await refreshRow();
          setMatrixDirty(false);
          list.finishEdit(id);
          resolve(true);
        } finally {
          busy.current = false;
          setSaving(false);
        }
      })();
    });
  }
  const { editing, requestEdit, requestCancel } = useListRow(id, {
    dirty,
    revert: () => {
      setStatus(row.status);
      setInstructions(row.instructions ?? "");
      setBulkQty(row.bulk_order_qty == null ? "" : String(row.bulk_order_qty));
      setInstructionsOpen(false);
      setMatrixDirty(false);
      setFormKey((k) => k + 1);
      setErr(null);
    },
    save: persist,
  });

  useEffect(() => {
    if (!editing) {
      setStatus(row.status);
      setInstructions(row.instructions ?? "");
      setBulkQty(row.bulk_order_qty == null ? "" : String(row.bulk_order_qty));
      setInstructionsOpen(false);
    }
  }, [row.status, row.instructions, row.bulk_order_qty, editing]);

  return (
    <SelectableRow id={id}>
      <td className="w-52 pr-2">
        <div className="font-medium leading-tight">{title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs leading-tight">
          {editing ? (
            <label>
              <input
                type="checkbox"
                className="mr-1"
                checked={status}
                onChange={(e) => setStatus(e.target.checked)}
              />
              Open
            </label>
          ) : (
            <span className="font-light text-stone-500">{row.status ? "Open" : "Complete"}</span>
          )}
          <span className="font-light tabular-nums text-stone-500">
            • {row.qty_received} of {qtyOrdered}
          </span>
        </div>
        {editing ? (
          <label className="mt-2 flex items-center gap-1 text-xs text-stone-500">
            Bulk
            <NumericInput
              className="h-6 w-16 rounded border border-stone-300 bg-white px-1 text-center text-xs text-stone-800"
              inputMode="numeric"
              aria-label="Bulk order qty"
              value={bulkQty}
              onChange={(e) => setBulkQty(e.target.value)}
            />
          </label>
        ) : row.bulk_order_qty != null ? (
          <div className="mt-1 text-xs font-light tabular-nums text-stone-500">
            Bulk • {row.bulk_order_qty}
          </div>
        ) : null}
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      <td className="w-full min-w-0 pr-1">
        <div className="flex min-w-0 flex-col">
          {editing ? (
            <form
              key={formKey}
              ref={formRef}
              className="min-w-0 w-full"
              onInput={() => setMatrixDirty(true)}
              onSubmit={(e) => {
                e.preventDefault();
                void persist();
              }}
            >
              <CuttingDropQtyGrid
                sizes={row.sizes}
                drops={row.drops}
                cells={row.cells}
                editable
                namePrefix="ord"
                onDirty={() => setMatrixDirty(true)}
              />
            </form>
          ) : (
            <CuttingDropQtyGrid sizes={row.sizes} drops={row.drops} cells={row.cells} />
          )}
          {editing ? (
            <textarea
              className={`mt-2 w-full resize-none rounded border px-2 py-1 text-sm leading-snug transition-[min-height] duration-150 ${
                instructionsOpen ? "min-h-24" : "min-h-7"
              }`}
              rows={instructionsOpen ? 5 : 1}
              placeholder="Instructions"
              value={instructions}
              onFocus={() => setInstructionsOpen(true)}
              onBlur={() => setInstructionsOpen(false)}
              onChange={(e) => setInstructions(e.target.value)}
            />
          ) : viewInstructions ? (
            <div className="mt-2 text-xs font-light leading-snug text-stone-500">
              Instructions • {viewInstructions}
            </div>
          ) : null}
        </div>
      </td>
      <td className="w-32 whitespace-nowrap py-1 pr-2">
        <div className="flex flex-col items-end gap-1">
          {onScale || onCopy ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
              {onScale ? (
                <button
                  type="button"
                  className={`text-xs underline ${
                    scaleOpen ? "font-medium text-teal-800" : "text-stone-700"
                  }`}
                  onClick={() => onScale(row)}
                >
                  Scale
                </button>
              ) : null}
              {onCopy ? (
                <button
                  type="button"
                  className={`text-xs underline ${
                    copyOpen ? "font-medium text-teal-800" : "text-stone-700"
                  }`}
                  onClick={() => onCopy(row)}
                >
                  Copy
                </button>
              ) : null}
            </div>
          ) : null}
        <RowButtons
          editing={editing}
          dirty={dirty}
          saving={saving}
          deleting={pending}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={
            editing
              ? undefined
              : () => {
                  if (!confirm(`Remove ${title}?`)) return;
                  start(async () => {
                    const message = await deleteCuttingOrderProduct(row.cutting_order_id, row.product_id);
                    if (message) setErr(message);
                    else router.refresh();
                  });
                }
          }
        />
        </div>
      </td>
    </SelectableRow>
  );
}
