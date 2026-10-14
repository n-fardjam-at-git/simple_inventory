"use client";

import { useRef, useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { ComboBox } from "@/components/ComboBox";
import { QtyMatrix, type Cell, type MatrixDrop, type MatrixSize } from "@/components/matrix/QtyMatrix";
import { productTitle } from "@/lib/product-type";
import { deleteCuttingOrderProduct, saveCuttingOrderLine } from "./actions";

export type CuttingOrderProductRow = {
  cutting_order_id: string;
  product_id: string;
  status: string;
  products: {
    type?: number | null;
    name?: string | null;
    lots?: { lot_no?: string } | null;
    models?: { name?: string; items?: { name?: string } | null } | null;
  } | null;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};

const STATUSES = [
  { id: "open", label: "open" },
  { id: "complete", label: "complete" },
];

function lineKey(row: CuttingOrderProductRow) {
  return `${row.cutting_order_id}:${row.product_id}`;
}

export function CuttingOrderProductsTable({ rows }: { rows: CuttingOrderProductRow[] }) {
  return (
    <FitList
      items={rows}
      getKey={lineKey}
      stretch
      tableClassName="inventory-boards"
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Product</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <ProductLineRow row={r} />}
    />
  );
}

function ProductLineRow({ row }: { row: CuttingOrderProductRow }) {
  const [status, setStatus] = useState(row.status);
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const list = useList();
  const title = productTitle(row.products ?? {});
  const id = lineKey(row);
  const dirty = status !== row.status || matrixDirty;

  function persist() {
    return new Promise<boolean>((resolve) => {
      const form = formRef.current;
      const formData = form ? new FormData(form) : new FormData();
      start(async () => {
        const message = await saveCuttingOrderLine(
          row.cutting_order_id,
          row.product_id,
          status,
          formData,
        );
        if (message) {
          setErr(message);
          resolve(false);
        } else {
          setErr(null);
          setMatrixDirty(false);
          list.finishEdit(id);
          resolve(true);
        }
      });
    });
  }
  const { editing, requestEdit, requestCancel } = useListRow(id, {
    dirty,
    revert: () => {
      setStatus(row.status);
      setMatrixDirty(false);
      setFormKey((k) => k + 1);
      setErr(null);
    },
    save: persist,
  });

  return (
    <SelectableRow id={id}>
      <td className="pr-3">
        <div className="font-medium leading-tight">{title}</div>
        {editing ? (
          <div className="mt-1">
            <ComboBox
              className="rounded border px-1 py-0.5"
              value={status}
              onChange={setStatus}
              options={STATUSES}
            />
          </div>
        ) : (
          <p className="text-xs font-light leading-tight text-stone-500">{row.status}</p>
        )}
        {pending ? <p className="text-xs text-stone-400">Working…</p> : null}
        {err ? <p className="text-xs text-red-700">{err}</p> : null}
      </td>
      <td className="w-[70%] pr-3">
        {editing ? (
          <form
            key={formKey}
            ref={formRef}
            className="w-full"
            onInput={() => setMatrixDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              void persist();
            }}
          >
            <QtyMatrix
              sizes={row.sizes}
              drops={row.drops}
              cells={row.cells}
              editable
              compact
              showTotals
              namePrefix="ord"
            />
          </form>
        ) : (
          <QtyMatrix sizes={row.sizes} drops={row.drops} cells={row.cells} compact showTotals />
        )}
      </td>
      <td className="w-px whitespace-nowrap py-1">
        <RowButtons
          editing={editing}
          dirty={dirty}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={() => {
            if (!confirm(`Remove ${title}?`)) return;
            start(async () => {
              const message = await deleteCuttingOrderProduct(row.cutting_order_id, row.product_id);
              if (message) setErr(message);
            });
          }}
        />
      </td>
    </SelectableRow>
  );
}
