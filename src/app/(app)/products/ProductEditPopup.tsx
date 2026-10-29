"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { PriceInput } from "@/components/PriceInput";
import { PriceStageRadios } from "@/components/PriceStageRadios";
import { AvailabilityPicker } from "@/components/AvailabilityPicker";
import { UpchargeMatrix } from "@/components/matrix/QtyMatrix";
import { type SeasonRow } from "@/lib/season";
import { isNoDropAxis, visibleDrops } from "@/lib/size-code";
import {
  loadProductEdit,
  saveMerchandiseProduct,
  type ProductEditDetail,
} from "./actions";
import { SaveAsTemplatePopup, type ProductTemplateOption } from "./SaveAsTemplatePopup";
import { ProductPhotos } from "./ProductPhotos";

type EditRow = {
  id: string;
  standard_price: number;
  price_stage?: number;
  availability?: string | null;
  is_active: boolean;
  collection_id?: string | null;
  size_chart_id?: string | null;
  lots: { brand_id?: string | null; lot_no?: string | null } | null;
  models: { item_id?: string | null } | null;
};

const field = "w-full rounded border border-stone-300 bg-white px-2 py-1";

export function ProductEditPopup({
  row,
  title,
  seasons,
  collections,
  templates,
  onDirtyChange,
  onCancel,
  onSaved,
  persistRef,
}: {
  row: EditRow;
  title: string;
  seasons: SeasonRow[];
  collections: { id: string; name: string; is_active: boolean }[];
  templates: ProductTemplateOption[];
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
  persistRef: { current: () => Promise<boolean> };
}) {
  const [detail, setDetail] = useState<ProductEditDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [price, setPrice] = useState(row.standard_price);
  const [priceKey, setPriceKey] = useState(0);
  const [priceDirty, setPriceDirty] = useState(false);
  const [active, setActive] = useState(row.is_active);
  const [priceStage, setPriceStage] = useState(row.price_stage ?? 1);
  const [availability, setAvailability] = useState<string | null>(row.availability ?? null);
  const [collectionId, setCollectionId] = useState(row.collection_id ?? "");
  const [sizeIds, setSizeIds] = useState<string[]>([]);
  const [dropIds, setDropIds] = useState<string[]>([]);
  const [photosDirty, setPhotosDirty] = useState(false);
  const photosSaveRef = useRef<() => Promise<string | null>>(async () => null);
  const photoPickerOpen = useRef(false);
  const [tplOpen, setTplOpen] = useState(false);
  const tplBtnRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const ignorePriceUntil = useRef(0);

  const chartSizes = detail?.chartSizes ?? [];
  const chartDrops = detail?.chartDrops ?? [];
  const cells = detail?.cells ?? [];
  const noDrop = isNoDropAxis(chartDrops);
  const shownDrops = noDrop ? chartDrops : visibleDrops(chartDrops);
  const selectedSizeIds = detail?.selectedSizeIds ?? [];
  const selectedDropIds = detail?.selectedDropIds ?? [];
  const subsetDirty =
    [...sizeIds].sort().join() !== [...selectedSizeIds].sort().join() ||
    [...dropIds].sort().join() !== [...selectedDropIds].sort().join();
  const sellingDirty =
    priceDirty ||
    active !== row.is_active ||
    priceStage !== (row.price_stage ?? 1) ||
    (availability ?? "") !== (row.availability ?? "") ||
    collectionId !== (row.collection_id ?? "");
  const dirty = sellingDirty || subsetDirty || photosDirty;

  const qtyBySize = new Map<string, number>();
  const qtyByDrop = new Map<string, number>();
  for (const cell of cells) {
    if (!(Number(cell.qty) > 0)) continue;
    qtyBySize.set(cell.size_id, (qtyBySize.get(cell.size_id) ?? 0) + Number(cell.qty));
    qtyByDrop.set(cell.drop_id, (qtyByDrop.get(cell.drop_id) ?? 0) + Number(cell.qty));
  }
  const matrixSizes = chartSizes.filter((s) => sizeIds.includes(s.id) || (qtyBySize.get(s.id) ?? 0) > 0);
  const matrixDrops = shownDrops.filter((d) => dropIds.includes(d.id) || (qtyByDrop.get(d.id) ?? 0) > 0);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    let gone = false;
    setLoading(true);
    setLoadErr(null);
    void loadProductEdit(row.id).then(({ detail: next, error }) => {
      if (gone) return;
      if (error || !next) {
        setLoadErr(error ?? "Could not load product.");
        setLoading(false);
        return;
      }
      setDetail(next);
      setSizeIds(next.selectedSizeIds);
      setDropIds(next.selectedDropIds);
      ignorePriceUntil.current = Date.now() + 500;
      setLoading(false);
    });
    return () => {
      gone = true;
    };
  }, [row.id]);

  useEffect(() => {
    persistRef.current = () =>
      new Promise<boolean>((resolve) => {
        const form = formRef.current;
        if (!form) {
          resolve(false);
          return;
        }
        const formData = new FormData(form);
        start(async () => {
          if (sellingDirty || subsetDirty) {
            const message = await saveMerchandiseProduct(row.id, formData);
            if (message) {
              setErr(message);
              resolve(false);
              return;
            }
          }
          const photoMessage = await photosSaveRef.current();
          if (photoMessage) {
            setErr(photoMessage);
            resolve(false);
            return;
          }
          setErr(null);
          onSaved();
          resolve(true);
        });
      });
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (photoPickerOpen.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (tplOpen) {
        setTplOpen(false);
        return;
      }
      onCancel();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel, tplOpen]);

  function markPriceDirty() {
    if (Date.now() < ignorePriceUntil.current) return;
    setPriceDirty(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void persistRef.current();
  }

  if (typeof document === "undefined") return null;

  const matchingTemplates = templates.filter(
    (t) =>
      t.brand_id === row.lots?.brand_id &&
      t.item_id === row.models?.item_id &&
      t.size_chart_id === row.size_chart_id,
  );

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-transparent"
        aria-label="Close"
        onClick={onCancel}
      />
      <div className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[min(78rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 items-stretch gap-3">
        <ProductPhotos
          productId={row.id}
          lotNo={row.lots?.lot_no ?? ""}
          onDirtyChange={setPhotosDirty}
          saveRef={photosSaveRef}
          pickerOpenRef={photoPickerOpen}
        >
        {() => (
        <div className="flex max-h-[90vh] min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-lg">
        <form
          ref={formRef}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={onSubmit}
          onInput={markPriceDirty}
          onChange={markPriceDirty}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
            <p className="min-w-0 truncate text-sm text-stone-800">
              <span className="font-medium">Edit product</span>
              <span className="font-light text-stone-500"> • {title}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                ref={tplBtnRef}
                type="button"
                className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 hover:bg-stone-50"
                onClick={() => setTplOpen(true)}
              >
                Save as template
              </button>
              <button
                type="button"
                className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
                aria-label="Close"
                onClick={onCancel}
              >
                ×
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm">
            {loading ? <p className="text-sm text-stone-500">Working…</p> : null}
            {loadErr ? <DismissNote onDismiss={() => setLoadErr(null)}>{loadErr}</DismissNote> : null}
            {detail ? (
            <>
            <input type="hidden" name="is_active" value={active ? "1" : "0"} />
            <section className="space-y-3">
              <h2 className="font-medium">Selling</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block min-w-0">
                  <span className="mb-1 block text-stone-500">Price</span>
                  <PriceInput
                    key={priceKey}
                    name="standard_price"
                    defaultValue={price}
                    className={field}
                  />
                </label>
                <div>
                  <p className="mb-1 text-stone-500">Price stage</p>
                  <PriceStageRadios value={priceStage} onChange={setPriceStage} />
                </div>
                <div>
                  <p className="mb-1 text-stone-500">Availability</p>
                  <AvailabilityPicker
                    seasons={seasons}
                    value={availability}
                    onChange={setAvailability}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="mb-1 block text-stone-500">Collection</span>
                  <ComboBox
                    name="collection_id"
                    allowEmpty
                    placeholder="Collection"
                    className={field}
                    value={collectionId}
                    onChange={setCollectionId}
                    options={collections
                      .filter((c) => c.is_active || c.id === collectionId)
                      .map((c) => ({ id: c.id, label: c.name }))}
                  />
                </label>
                <label className="flex items-end gap-1.5 pb-1">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>
            </section>
            <section className="space-y-3 border-t border-stone-200 pt-4">
              <h2 className="font-medium">{noDrop ? "Size subset" : "Size / drop subset"}</h2>
              <p className="text-xs text-stone-500">
                Add sizes{noDrop ? "" : " and drops"} anytime. A size
                {noDrop ? "" : " or drop"} with quantity on hand stays checked until that stock is
                zero.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-stone-500">Sizes</p>
                  <div className="flex flex-wrap gap-2">
                    {chartSizes.map((s) => {
                      const onHand = qtyBySize.get(s.id) ?? 0;
                      const locked = onHand > 0;
                      const checked = locked || sizeIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={locked ? "text-stone-400" : undefined}
                          title={locked ? `Can't remove ${s.code} — ${onHand} on hand` : undefined}
                        >
                          {locked ? <input type="hidden" name="size_id" value={s.id} /> : null}
                          <input
                            className="mr-1"
                            type="checkbox"
                            name={locked ? undefined : "size_id"}
                            value={s.id}
                            checked={checked}
                            disabled={locked}
                            onChange={() => {
                              setSizeIds((prev) =>
                                prev.includes(s.id)
                                  ? prev.filter((id) => id !== s.id)
                                  : [...prev, s.id],
                              );
                            }}
                          />
                          {s.code}
                        </label>
                      );
                    })}
                  </div>
                </div>
                {noDrop ? (
                  chartDrops.map((d) => (
                    <input key={d.id} type="hidden" name="drop_id" value={d.id} />
                  ))
                ) : (
                  <div>
                    <p className="mb-1 text-stone-500">Drops</p>
                    <div className="flex flex-wrap gap-2">
                      {shownDrops.map((d) => {
                        const onHand = qtyByDrop.get(d.id) ?? 0;
                        const locked = onHand > 0;
                        const checked = locked || dropIds.includes(d.id);
                        return (
                          <label
                            key={d.id}
                            className={locked ? "text-stone-400" : undefined}
                            title={locked ? `Can't remove ${d.code} — ${onHand} on hand` : undefined}
                          >
                            {locked ? <input type="hidden" name="drop_id" value={d.id} /> : null}
                            <input
                              className="mr-1"
                              type="checkbox"
                              name={locked ? undefined : "drop_id"}
                              value={d.id}
                              checked={checked}
                              disabled={locked}
                              onChange={() => {
                                setDropIds((prev) =>
                                  prev.includes(d.id)
                                    ? prev.filter((id) => id !== d.id)
                                    : [...prev, d.id],
                                );
                              }}
                            />
                            {d.code}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
            <section className="space-y-3 border-t border-stone-200 pt-4">
              <h2 className="font-medium text-teal-900">Size upcharges</h2>
              <p className="text-xs text-teal-800/80">
                Extra dollars on the line price for that size × drop. Leave blank for none.
              </p>
              {matrixSizes.length && matrixDrops.length ? (
                <UpchargeMatrix sizes={matrixSizes} drops={matrixDrops} cells={cells} />
              ) : (
                <p className="text-xs text-stone-500">Check sizes to set upcharges.</p>
              )}
            </section>
            {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
            </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 border-t border-stone-200 px-4 py-3">
            {dirty ? <Btn type="submit" busy={pending}>Save</Btn> : null}
            <button
              type="button"
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </form>
        {tplOpen ? (
          <SaveAsTemplatePopup
            productId={row.id}
            templates={matchingTemplates}
            anchor={tplBtnRef.current}
            onClose={() => setTplOpen(false)}
          />
        ) : null}
        </div>
        )}
        </ProductPhotos>
      </div>
    </>,
    document.body,
  );
}
