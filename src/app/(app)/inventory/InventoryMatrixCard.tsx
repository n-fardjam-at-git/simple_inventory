"use client";

import { useRef, useState, useTransition } from "react";
import { QtyMatrix, type Cell, type MatrixDrop, type MatrixSize } from "@/components/matrix/QtyMatrix";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { saveInventoryMatrix } from "./actions";

export type InventoryBoard = {
  productId: string;
  title: string;
  subtitle: string;
  fabric: string;
  isActive: boolean;
  availability: string | null;
  collectionId: string | null;
  brandId: string | null;
  lotNo: string | null;
  itemId: string | null;
  modelId: string | null;
  colorId: string | null;
  patternId: string | null;
  contentId: string | null;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};

export function InventoryMatrixCard({
  productId,
  title,
  subtitle,
  fabric,
  isActive,
  availability,
  sizes,
  drops,
  cells,
  canEdit,
}: InventoryBoard & { canEdit: boolean }) {
  const [dirty, setDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const list = useList();

  function persist() {
    return new Promise<boolean>((resolve) => {
      const form = formRef.current;
      if (!form) {
        list.finishEdit(productId);
        resolve(true);
        return;
      }
      const formData = new FormData(form);
      startTransition(async () => {
        await saveInventoryMatrix(productId, formData);
        setDirty(false);
        list.finishEdit(productId);
        resolve(true);
      });
    });
  }

  const { editing, requestEdit, requestCancel } = useListRow(productId, {
    dirty,
    revert: () => {
      setDirty(false);
      setFormKey((k) => k + 1);
    },
    save: persist,
  });

  return (
    <SelectableRow id={productId} dimmed={!isActive}>
      <td className="pr-3">
        <div className="font-medium leading-tight">{title}</div>
        <p className="text-xs leading-tight text-stone-500">{subtitle}</p>
        <p className="text-xs font-light leading-tight text-stone-500">
          {fabric ? `${fabric}. ` : ""}
          {isActive ? "Active" : "Inactive"}
        </p>
        {availability ? (
          <p className="text-xs font-light leading-tight text-stone-500">{availability}</p>
        ) : null}
        {pending ? <p className="text-xs text-stone-400">Working…</p> : null}
      </td>
      <td className="w-[70%] pr-3">
        {editing ? (
          <form
            key={formKey}
            ref={formRef}
            id={`inv-${productId}`}
            className="w-full"
            onInput={() => setDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              void persist();
            }}
          >
            <QtyMatrix
              sizes={sizes}
              drops={drops}
              cells={cells}
              editable
              compact
              showTotals
              namePrefix="inv"
            />
          </form>
        ) : (
          <QtyMatrix sizes={sizes} drops={drops} cells={cells} compact showTotals />
        )}
      </td>
      <td className="w-px whitespace-nowrap">
        {canEdit ? (
          <RowButtons
            editing={editing}
            dirty={dirty}
            onEdit={requestEdit}
            onSave={() => void persist()}
            onCancel={requestCancel}
          />
        ) : null}
      </td>
    </SelectableRow>
  );
}
