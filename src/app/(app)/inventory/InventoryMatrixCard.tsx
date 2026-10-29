"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { QtyMatrix, type Cell, type MatrixDrop, type MatrixSize } from "@/components/matrix/QtyMatrix";
import { ProductImageGallery } from "@/components/ProductImageGallery";
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
  sizes,
  drops,
  cells,
  openCuttings,
  images,
  canEdit,
}: InventoryBoard & { canEdit: boolean }) {
  const [dirty, setDirty] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [hoverBox, setHoverBox] = useState<{ left: number; top: number } | null>(null);
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

  const thumb = images[0];
  const photoThumb = thumb ? (
    <button
      type="button"
      className="h-12 w-12 cursor-pointer overflow-hidden rounded border border-stone-300 bg-white"
      aria-label={`Photos for ${title}`}
      title="Click to view more pictures"
      onMouseEnter={(e) => setHoverBox(placeThumbPreview(e.currentTarget))}
      onMouseLeave={() => setHoverBox(null)}
      onClick={() => {
        setHoverBox(null);
        setPhotosOpen(true);
      }}
    >
      <img src={thumb.thumb || thumb.src} alt="" className="h-full w-full object-cover" />
    </button>
  ) : null;

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
              grandTotalExtra={photoThumb}
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
            grandTotalExtra={photoThumb}
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
      {hoverBox && thumb && !photosOpen ? (
        <InventoryThumbPreview src={thumb.src} alt={title} box={hoverBox} onHide={() => setHoverBox(null)} />
      ) : null}
      {photosOpen && images.length ? (
        <InventoryPhotoWindow title={title} images={images} onClose={() => setPhotosOpen(false)} />
      ) : null}
    </SelectableRow>
  );
}

const THUMB_PHOTO = 144;
const THUMB_FRAME = 12;
const THUMB_PREVIEW = THUMB_PHOTO + THUMB_FRAME * 2;

function placeThumbPreview(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const gap = 8;
  let left = rect.left - THUMB_PREVIEW - gap;
  let top = rect.bottom - THUMB_PREVIEW;
  if (left < 8) left = Math.min(rect.right + gap, window.innerWidth - THUMB_PREVIEW - 8);
  if (top < 8) top = 8;
  return { left, top };
}

function InventoryThumbPreview({
  src,
  alt,
  box,
  onHide,
}: {
  src: string;
  alt: string;
  box: { left: number; top: number };
  onHide: () => void;
}) {
  useEffect(() => {
    window.addEventListener("scroll", onHide, true);
    return () => window.removeEventListener("scroll", onHide, true);
  }, [onHide]);

  return createPortal(
    <div
      className="pointer-events-none fixed z-30 p-3 shadow-md"
      style={{
        left: box.left,
        top: box.top,
        width: THUMB_PREVIEW,
        height: THUMB_PREVIEW,
        background:
          "radial-gradient(circle, #ffffff 58%, #f5f5f4 76%, #d6d3d1 100%)",
      }}
    >
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>,
    document.body,
  );
}

function InventoryPhotoWindow({
  title,
  images,
  onClose,
}: {
  title: string;
  images: { src: string; thumb: string }[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-transparent"
        aria-label="Close photos"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 z-[70] flex max-h-[90vh] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-lg">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 px-3 py-3">
          <h2 className="min-w-0 truncate text-sm font-medium">{title}</h2>
          <button
            type="button"
            className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-200"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ProductImageGallery images={images} alt={title} panel />
        </div>
      </div>
    </>,
    document.body,
  );
}
