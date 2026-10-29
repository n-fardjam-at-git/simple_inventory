"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { PriceInput } from "@/components/PriceInput";
import { PriceStageRadios } from "@/components/PriceStageRadios";
import { AvailabilityPicker } from "@/components/AvailabilityPicker";
import { UpchargeMatrix } from "@/components/matrix/QtyMatrix";
import { PRICE_STAGE } from "@/lib/product-type";
import { type SeasonRow } from "@/lib/season";
import { isNoDropAxis, visibleDrops } from "@/lib/size-code";
import { createMerchandiseProduct } from "@/app/(app)/products/actions";

export type CatalogModel = {
  id: string;
  name: string;
  item_id: string;
  size_chart_id: string;
  item_name: string | null;
};

export type ChartDim = { id: string; code: string; chart_id: string; sort_order: number };

export function NewOrderProductPopup({
  lotId,
  itemId,
  models,
  sizes,
  drops,
  seasons,
  collections,
  onClose,
}: {
  lotId: string;
  itemId: string | null;
  models: CatalogModel[];
  sizes: ChartDim[];
  drops: ChartDim[];
  seasons: SeasonRow[];
  collections: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [modelId, setModelId] = useState("");
  const [priceStage, setPriceStage] = useState(PRICE_STAGE.line);
  const [availability, setAvailability] = useState<string | null>(null);
  const [upOpen, setUpOpen] = useState(false);
  const [sizeIds, setSizeIds] = useState<string[]>([]);
  const [dropIds, setDropIds] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const upRef = useRef<HTMLDivElement>(null);

  const filtered = models.filter((m) => !itemId || m.item_id === itemId);
  const chartId = filtered.find((m) => m.id === modelId)?.size_chart_id ?? "";
  const chartSizes = sizes
    .filter((s) => s.chart_id === chartId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const chartDrops = drops
    .filter((d) => d.chart_id === chartId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const noDrop = isNoDropAxis(chartDrops);
  const shownDrops = noDrop ? chartDrops : visibleDrops(chartDrops);
  const matrixSizes = chartSizes.filter((s) => sizeIds.includes(s.id));
  const matrixDrops = shownDrops.filter((d) => dropIds.includes(d.id));

  useEffect(() => {
    setSizeIds(chartSizes.map((s) => s.id));
    setDropIds(shownDrops.map((d) => d.id));
  }, [chartId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (upOpen) {
        setUpOpen(false);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, upOpen]);

  useLayoutEffect(() => {
    if (!upOpen) return;
    const wrap = wrapRef.current;
    const up = upRef.current;
    if (!wrap || !up) return;
    function size() {
      const clip = wrap.closest("[data-clip]");
      if (!clip) return;
      const pad = 8;
      const gap = 8;
      const left = clip.getBoundingClientRect().left + pad;
      const right = wrap.getBoundingClientRect().left - gap;
      up.style.width = `${Math.max(16, Math.round(right - left))}px`;
    }
    size();
    const clip = wrap.closest("[data-clip]");
    const ro = clip ? new ResizeObserver(size) : null;
    if (clip) ro?.observe(clip);
    window.addEventListener("resize", size);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", size);
    };
  }, [upOpen]);

  function save(formData: FormData) {
    start(async () => {
      const message = await createMerchandiseProduct(formData);
      if (message) {
        setErr(message);
        return;
      }
      onClose();
    });
  }

  return (
    <form className="absolute top-0 right-full z-30 mr-2" action={save}>
      <div ref={wrapRef} className="relative">
      <div className="w-80 max-h-[70vh] overflow-y-auto rounded-lg border border-stone-200 bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-700">New product</p>
        <button
          type="button"
          className={`rounded border px-1.5 py-0.5 text-[11px] leading-none ${
            upOpen
              ? "border-stone-900 bg-stone-900 text-white"
              : "border-stone-400 text-stone-700"
          } ${chartId ? "" : "opacity-40"}`}
          onClick={() => chartId && setUpOpen((cur) => !cur)}
        >
          Upcharges
        </button>
      </div>
      <input type="hidden" name="lot_id" value={lotId} />
      <div className="flex flex-col gap-2 text-sm">
        <label className="block">
          <span className="mb-1 block text-stone-500">Model</span>
          <ComboBox
            name="model_id"
            required
            placeholder="Model"
            className="w-full rounded border px-2 py-1"
            value={modelId}
            onChange={setModelId}
            options={filtered.map((m) => ({
              id: m.id,
              label: m.item_name ? `${m.item_name} · ${m.name}` : m.name,
            }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Collection</span>
          <ComboBox
            name="collection_id"
            allowEmpty
            placeholder="Collection"
            className="w-full rounded border px-2 py-1"
            options={collections.map((c) => ({ id: c.id, label: c.name }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Price</span>
          <PriceInput name="standard_price" defaultValue={0} className="w-full rounded border px-2 py-1" />
        </label>
        <div>
          <p className="mb-1 text-stone-500">Price stage</p>
          <PriceStageRadios value={priceStage} onChange={setPriceStage} />
        </div>
        <div>
          <p className="mb-1 text-stone-500">Availability</p>
          <AvailabilityPicker seasons={seasons} value={availability} onChange={setAvailability} />
        </div>
        {chartId ? (
          <>
            <div>
              <p className="mb-1 font-medium">Sizes</p>
              <div className="flex flex-wrap gap-2">
                {chartSizes.map((s) => (
                  <label key={s.id}>
                    <input
                      className="mr-1"
                      type="checkbox"
                      name="size_id"
                      value={s.id}
                      checked={sizeIds.includes(s.id)}
                      onChange={() => {
                        setSizeIds((prev) =>
                          prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                        );
                      }}
                    />
                    {s.code}
                  </label>
                ))}
              </div>
            </div>
            {noDrop ? (
              chartDrops.map((d) => <input key={d.id} type="hidden" name="drop_id" value={d.id} />)
            ) : (
              <div>
                <p className="mb-1 font-medium">Drops</p>
                <div className="flex flex-wrap gap-2">
                  {shownDrops.map((d) => (
                    <label key={d.id}>
                      <input
                        className="mr-1"
                        type="checkbox"
                        name="drop_id"
                        value={d.id}
                        checked={dropIds.includes(d.id)}
                        onChange={() => {
                          setDropIds((prev) =>
                            prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id],
                          );
                        }}
                      />
                      {d.code}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
      {err ? (
        <DismissNote className="mt-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
          {err}
        </DismissNote>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Btn type="submit" busy={pending}>
          Create
        </Btn>
        <button
          type="button"
          className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
      </div>
      <div
        ref={upRef}
        className={
          upOpen
            ? "absolute top-0 right-full z-40 mr-2 max-h-[70vh] overflow-auto rounded-lg border border-teal-200 bg-white p-3 shadow-lg"
            : "hidden"
        }
      >
        <p className="mb-1 text-sm font-medium text-teal-900">Size upcharges</p>
        <p className="mb-2 text-xs text-teal-800/80">
          Extra dollars on the line price for that size × drop. Leave blank for none.
        </p>
        {matrixSizes.length && matrixDrops.length ? (
          <UpchargeMatrix key={chartId} sizes={matrixSizes} drops={matrixDrops} cells={[]} />
        ) : (
          <p className="text-xs text-teal-800/80">Check sizes to set upcharges.</p>
        )}
      </div>
      </div>
    </form>
  );
}
