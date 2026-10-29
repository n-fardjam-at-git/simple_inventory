"use client";

import { DismissNote } from "@/components/DismissNote";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { UpchargeMatrix, type Cell, type MatrixDrop, type MatrixSize } from "@/components/matrix/QtyMatrix";
import { PriceInput } from "@/components/PriceInput";
import { Card, Btn, PageTitle } from "@/components/ui";
import { savePrices, saveSubset } from "../actions";
import { isNoDropAxis, resolveProductDropIds, visibleDrops } from "@/lib/size-code";

function SavedFade({ showKey }: { showKey: number }) {
  const [opaque, setOpaque] = useState(true);
  useEffect(() => {
    if (!showKey) return;
    setOpaque(true);
    const t = setTimeout(() => setOpaque(false), 1400);
    return () => clearTimeout(t);
  }, [showKey]);
  if (!showKey) return null;
  return (
    <span
      className={`text-sm text-teal-800 transition-opacity duration-700 ${
        opaque ? "opacity-100" : "opacity-0"
      }`}
    >
      Saved
    </span>
  );
}

export function ProductSettingsEditor({
  title,
  productId,
  merch,
  standardPrice,
  sizes,
  drops,
  cells,
  chartSizes,
  chartDrops,
  selectedSizeIds,
  selectedDropIds,
  resumeListEdit = false,
  children,
}: {
  title: string;
  productId: string;
  merch: boolean;
  standardPrice: number;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
  chartSizes: { id: string; code: string }[];
  chartDrops: { id: string; code: string }[];
  selectedSizeIds: string[];
  selectedDropIds: string[];
  resumeListEdit?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const listHref = resumeListEdit ? `/products?edit=${productId}` : "/products";
  const [priceDirty, setPriceDirty] = useState(false);
  const [priceKey, setPriceKey] = useState(0);
  const [leave, setLeave] = useState(false);
  const [priceSaved, setPriceSaved] = useState(0);
  const [subsetSaved, setSubsetSaved] = useState(0);
  const [subsetErr, setSubsetErr] = useState<string | null>(null);
  const [subsetSaving, setSubsetSaving] = useState(false);
  const [sizeIds, setSizeIds] = useState(selectedSizeIds);
  const [dropIds, setDropIds] = useState(selectedDropIds);
  const ignorePriceDirtyUntil = useRef(0);
  const shownDrops = visibleDrops(chartDrops);
  const noDrop = isNoDropAxis(chartDrops);
  const subsetDirty =
    merch &&
    ([...sizeIds].sort().join() !== [...selectedSizeIds].sort().join() ||
      [...dropIds].sort().join() !== [...selectedDropIds].sort().join());
  const dirty = priceDirty || subsetDirty;

  function markPriceDirty() {
    if (Date.now() < ignorePriceDirtyUntil.current) return;
    setPriceDirty(true);
  }
  const qtyBySize = new Map<string, number>();
  const qtyByDrop = new Map<string, number>();
  for (const cell of cells) {
    if (!(Number(cell.qty) > 0)) continue;
    qtyBySize.set(cell.size_id, (qtyBySize.get(cell.size_id) ?? 0) + Number(cell.qty));
    qtyByDrop.set(cell.drop_id, (qtyByDrop.get(cell.drop_id) ?? 0) + Number(cell.qty));
  }

  useEffect(() => {
    setSizeIds(selectedSizeIds);
    setDropIds(selectedDropIds);
  }, [selectedSizeIds.join("|"), selectedDropIds.join("|")]);

  function close() {
    if (dirty) setLeave(true);
    else router.push(listHref);
  }

  return (
    <>
      <PageTitle
        title={title}
        className="mb-0"
        actions={
          <button
            type="button"
            className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
            aria-label="Close"
            onClick={close}
          >
            ×
          </button>
        }
      />
      {children}

      <div className="space-y-6">
        <Card>
          <h2 className="mb-3 font-medium">Price & size upcharges</h2>
          <form
            key={priceKey}
            action={async (formData) => {
              await savePrices(productId, formData);
              ignorePriceDirtyUntil.current = Date.now() + 500;
              setPriceDirty(false);
              setPriceSaved((n) => n + 1);
            }}
            className="space-y-4"
            onInput={markPriceDirty}
            onChange={markPriceDirty}
          >
            <label className="block text-sm">
              Price
              <PriceInput
                name="standard_price"
                defaultValue={standardPrice}
                className="ml-2 rounded border border-stone-300 px-2 py-1"
              />
            </label>
            {merch ? (
              <div>
                <h3 className="mb-1 font-medium text-teal-900">Size upcharges</h3>
                <p className="mb-2 text-xs text-teal-800/80">
                  Extra dollars on the line price for that size × drop. Leave blank for none.
                </p>
                <UpchargeMatrix sizes={sizes} drops={drops} cells={cells} />
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              {priceDirty ? (
                <>
                  <Btn type="submit">Save</Btn>
                  <button
                    type="button"
                    className="rounded border border-stone-300 px-3 py-1.5 text-sm"
                    onClick={() => {
                      setPriceKey((k) => k + 1);
                      setPriceDirty(false);
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : null}
              <SavedFade showKey={priceSaved} />
            </div>
          </form>
        </Card>

        {merch ? (
          <Card>
            <h2 className="mb-3 font-medium">{noDrop ? "Size subset" : "Size / drop subset"}</h2>
            <p className="mb-3 text-xs text-stone-500">
              You can add sizes{noDrop ? "" : " and drops"} anytime. A size
              {noDrop ? "" : " or drop"} with quantity on hand stays checked until that stock
              is zero.
              {noDrop
                ? ""
                : " Uncheck every drop to use none."}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (subsetSaving) return;
                setSubsetSaving(true);
                void (async () => {
                  try {
                    const lockedSizes = chartSizes
                      .filter((s) => (qtyBySize.get(s.id) ?? 0) > 0)
                      .map((s) => s.id);
                    const lockedDrops = shownDrops
                      .filter((d) => (qtyByDrop.get(d.id) ?? 0) > 0)
                      .map((d) => d.id);
                    const nextSizes = [...new Set([...sizeIds, ...lockedSizes])];
                    const resolved = resolveProductDropIds(chartDrops, [
                      ...dropIds,
                      ...lockedDrops,
                    ]);
                    if (resolved.error) {
                      setSubsetErr(resolved.error);
                      return;
                    }
                    const nextDrops = resolved.ids;
                    const message = await saveSubset(productId, nextSizes, nextDrops);
                    if (message) {
                      setSubsetErr(message);
                      return;
                    }
                    setSizeIds(nextSizes);
                    setDropIds(nextDrops);
                    setSubsetErr(null);
                    setSubsetSaved((n) => n + 1);
                    router.refresh();
                  } finally {
                    setSubsetSaving(false);
                  }
                })();
              }}
            >
              <p className="mb-1 text-xs text-stone-500">Sizes</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {chartSizes.map((s) => {
                  const onHand = qtyBySize.get(s.id) ?? 0;
                  const locked = onHand > 0;
                  const checked = locked || sizeIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`text-sm ${locked ? "text-stone-400" : ""}`}
                      title={
                        locked ? `Can't remove ${s.code} — ${onHand} on hand` : undefined
                      }
                    >
                      <input
                        className="mr-1"
                        type="checkbox"
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
              {noDrop ? null : (
                <>
              <p className="mb-1 text-xs text-stone-500">Drops</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {shownDrops.map((d) => {
                  const onHand = qtyByDrop.get(d.id) ?? 0;
                  const locked = onHand > 0;
                  const checked = locked || dropIds.includes(d.id);
                  return (
                    <label
                      key={d.id}
                      className={`text-sm ${locked ? "text-stone-400" : ""}`}
                      title={
                        locked ? `Can't remove ${d.code} — ${onHand} on hand` : undefined
                      }
                    >
                      <input
                        className="mr-1"
                        type="checkbox"
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
                </>
              )}
              <div className="flex items-center gap-3">
                {subsetDirty ? (
                  <>
                    <Btn type="submit" busy={subsetSaving}>Save</Btn>
                    <button
                      type="button"
                      className="rounded border border-stone-300 px-3 py-1.5 text-sm"
                      onClick={() => {
                        setSizeIds(selectedSizeIds);
                        setDropIds(selectedDropIds);
                        setSubsetErr(null);
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : null}
                <SavedFade showKey={subsetSaved} />
              </div>
              {subsetErr ? (
                <DismissNote className="mt-2 text-xs text-red-700" onDismiss={() => setSubsetErr(null)}>
                  {subsetErr}
                </DismissNote>
              ) : null}
            </form>
          </Card>
        ) : null}
      </div>

      {leave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-sm rounded-lg bg-white p-4 shadow-lg">
            <p className="mb-4 text-sm">This page has unsaved changes.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-stone-300 px-3 py-1.5 text-sm"
                onClick={() => setLeave(false)}
              >
                Stay
              </button>
              <button
                type="button"
                className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white"
                onClick={() => router.push(listHref)}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
