"use client";

import { useRef, useState, useTransition } from "react";
import { QtyMatrix, type Cell, type MatrixDrop, type MatrixSize } from "@/components/matrix/QtyMatrix";
import { ProductThumb } from "@/components/ProductThumb";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { isSpecialPriceStage, priceStageLabel } from "@/lib/product-type";
import { saveInventoryMatrix } from "./actions";

export type InventoryBoard = {
  productId: string;
  title: string;
  standardPrice: number;
  priceStage: number;
  subtitle: string;
  fabric: string;
  isActive: boolean;
  availability: string | null;
  location: string | null;
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
  openCuttings: { orderNum: number; arrivalDate: string }[];
  images: { src: string; thumb: string }[];
};

export function InventoryMatrixCard({
  productId,
  title,
  standardPrice,
  priceStage,
  subtitle,
  fabric,
  isActive,
  availability,
  location,
  sizes,
  drops,
  cells,
  openCuttings,
  images,
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
      <td className="pr-3 align-top">
        <div className="font-medium leading-tight">
          {title}
          {isSpecialPriceStage(priceStage) ? (
            <span className="ml-1.5 text-xs font-light text-red-700">
              {priceStageLabel(priceStage)}
            </span>
          ) : null}
          <span className="ml-1.5 font-light text-stone-500">
            ${Number(standardPrice).toFixed(2)}
          </span>
        </div>
        <p className="text-xs leading-tight text-stone-500">{subtitle}</p>
        {editing ? (
          <input
            key={formKey}
            name="location"
            form={`inv-${productId}`}
            defaultValue={location ?? ""}
            placeholder="Aisle or note"
            aria-label="Location"
            maxLength={200}
            className="mt-1 w-full rounded border border-stone-300 px-1 py-0.5 text-xs"
            onChange={() => setDirty(true)}
          />
        ) : location ? (
          <p className="text-xs leading-tight text-stone-800">{location}</p>
        ) : null}
        <p className="text-xs font-light leading-tight text-stone-500">
          {fabric ? `${fabric}. ` : ""}
          {isActive ? "Active" : "Inactive"}
        </p>
        {availability ? (
          <p className="text-xs font-light leading-tight text-stone-500">{availability}</p>
        ) : null}
        {openCuttings.length ? (
          <label className="mt-1 flex items-center gap-1 text-xs font-light text-stone-500">
            Open cuttings
            <select
              className="min-w-0 rounded border border-stone-300 bg-white px-1 py-0.5 text-xs tabular-nums text-stone-700"
              defaultValue={String(openCuttings[0].orderNum)}
              aria-label="Open cuttings"
            >
              {openCuttings.map((c) => (
                <option key={c.orderNum} value={c.orderNum}>
                  {c.arrivalDate ? `${c.arrivalDate} • ${c.orderNum}` : String(c.orderNum)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
              grandTotalExtra={<ProductThumb title={title} images={images} />}
              namePrefix="inv"
            />
          </form>
        ) : (
          <QtyMatrix
            sizes={sizes}
            drops={drops}
            cells={cells}
            compact
            showTotals
            grandTotalExtra={<ProductThumb title={title} images={images} />}
          />
        )}
      </td>
      <td className="w-px whitespace-nowrap">
        {canEdit ? (
          <RowButtons
            editing={editing}
            dirty={dirty}
            saving={pending}
            onEdit={requestEdit}
            onSave={() => void persist()}
            onCancel={requestCancel}
          />
        ) : null}
      </td>
    </SelectableRow>
  );
}

