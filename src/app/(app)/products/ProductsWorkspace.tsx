"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ComboBox } from "@/components/ComboBox";
import { AvailabilityPicker } from "@/components/AvailabilityPicker";
import { sortSeasonsDesc, type SeasonRow } from "@/lib/season";
import { PRICE_STAGE, priceStageLabel, productTitle } from "@/lib/product-type";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { ProductsTable, type Row } from "./ProductsTable";
import type { ProductTemplateOption } from "./SaveAsTemplatePopup";

type Opt = { id: string; name: string; is_active?: boolean };

type Filters = {
  name: string;
  collectionId: string;
  brandId: string;
  itemId: string;
  modelId: string;
  lotNo: string;
  colorId: string;
  patternId: string;
  contentId: string;
  priceStage: string;
  availability: string;
  active: string;
};

const EMPTY: Filters = {
  name: "",
  collectionId: "",
  brandId: "",
  itemId: "",
  modelId: "",
  lotNo: "",
  colorId: "",
  patternId: "",
  contentId: "",
  priceStage: "",
  availability: "",
  active: "",
};

function contains(hay: string | null | undefined, needle: string) {
  const q = needle.trim().toLocaleLowerCase("en");
  if (!q) return true;
  return (hay ?? "").toLocaleLowerCase("en").includes(q);
}

function applyFilters(rows: Row[], f: Filters) {
  return rows.filter((r) => {
    const title = productTitle(r);
    if (!contains(title, f.name) && !contains(r.name, f.name)) return false;
    if (f.collectionId && r.collection_id !== f.collectionId) return false;
    if (f.brandId && r.lots?.brand_id !== f.brandId) return false;
    if (f.itemId && r.models?.item_id !== f.itemId) return false;
    if (f.modelId && r.models?.id !== f.modelId) return false;
    if (!contains(r.lots?.lot_no, f.lotNo)) return false;
    if (f.colorId && r.lots?.color_id !== f.colorId) return false;
    if (f.patternId && r.lots?.pattern_id !== f.patternId) return false;
    if (f.contentId && r.lots?.content_id !== f.contentId) return false;
    if (f.priceStage && String(r.price_stage ?? 1) !== f.priceStage) return false;
    if (f.availability && (r.availability ?? "") !== f.availability) return false;
    if (f.active === "1" && !r.is_active) return false;
    if (f.active === "0" && r.is_active) return false;
    return true;
  });
}

const field = "w-full rounded border py-1 pr-6 pl-2";

export function ProductsWorkspace({
  rows,
  canEdit,
  seasons,
  collections,
  brands,
  items,
  models,
  colors,
  patterns,
  contents,
  resumeId,
  templates = [],
}: {
  rows: Row[];
  canEdit: boolean;
  seasons: SeasonRow[];
  collections: Opt[];
  brands: Opt[];
  items: Opt[];
  models: Opt[];
  colors: Opt[];
  patterns: Opt[];
  contents: Opt[];
  resumeId: string | null;
  templates?: ProductTemplateOption[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const filtered = useMemo(() => applyFilters(rows, applied), [rows, applied]);
  const isFiltered = Object.values(applied).some((v) => v.trim());
  const nameEntered = Boolean(draft.name.trim());
  const orderedSeasons = sortSeasonsDesc(seasons);
  const nameOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const r of rows) {
      const label = productTitle(r);
      const key = label.toLocaleLowerCase("en");
      if (!label || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: label, label });
    }
    return out;
  }, [rows]);

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setComboKey((n) => n + 1);
  }

  function findByName() {
    const t = draft.name.trim().toLocaleLowerCase("en");
    if (!t) return;
    const row = filtered.find((r) => productTitle(r).toLocaleLowerCase("en") === t);
    if (!row) return;
    setFocusId(row.id);
    setFocusNonce((n) => n + 1);
    setOpen(false);
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        {rows.length ? (
          <button
            type="button"
            className={filterToggleClass(isFiltered)}
            onClick={() => setOpen(true)}
          >
            {isFiltered ? "Filtered" : "Filter"}
          </button>
        ) : null}
        {canEdit ? (
          <Link
            className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white"
            href="/products/new"
          >
            New merchandise
          </Link>
        ) : null}
      </div>

      <DockedFilterPanel
        open={open}
        onClose={() => setOpen(false)}
        onApply={() => setApplied(draft)}
        onReset={reset}
        comboKey={comboKey}
      >
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Name</span>
            <FilterClear
              goVisible={nameEntered}
              onGo={findByName}
              onClear={() => setDraft((d) => ({ ...d, name: "" }))}
            >
              <ComboBox
                allowEmpty
                allowAny
                className={`w-full rounded border py-1 pl-2 ${nameEntered ? "pr-10" : "pr-6"}`}
                value={draft.name}
                onChange={(id) => setDraft((d) => ({ ...d, name: id }))}
                options={nameOptions}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Collection</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, collectionId: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.collectionId}
                onChange={(id) => setDraft((d) => ({ ...d, collectionId: id }))}
                options={collections.map((c) => ({ id: c.id, label: c.name }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Brand</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, brandId: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.brandId}
                onChange={(id) => setDraft((d) => ({ ...d, brandId: id }))}
                options={brands.map((b) => ({ id: b.id, label: b.name }))}
              />
            </FilterClear>
          </label>
        </div>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Lot #</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, lotNo: "" }))}>
              <input
                className={field}
                value={draft.lotNo}
                onChange={(e) => setDraft((d) => ({ ...d, lotNo: e.target.value }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Item</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, itemId: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.itemId}
                onChange={(id) => setDraft((d) => ({ ...d, itemId: id }))}
                options={items.map((i) => ({ id: i.id, label: i.name }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Model</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, modelId: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.modelId}
                onChange={(id) => setDraft((d) => ({ ...d, modelId: id }))}
                options={models.map((m) => ({ id: m.id, label: m.name }))}
              />
            </FilterClear>
          </label>
        </div>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Color</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, colorId: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.colorId}
                onChange={(id) => setDraft((d) => ({ ...d, colorId: id }))}
                options={colors.map((c) => ({ id: c.id, label: c.name }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Pattern</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, patternId: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.patternId}
                onChange={(id) => setDraft((d) => ({ ...d, patternId: id }))}
                options={patterns.map((c) => ({ id: c.id, label: c.name }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Content</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, contentId: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.contentId}
                onChange={(id) => setDraft((d) => ({ ...d, contentId: id }))}
                options={contents.map((c) => ({ id: c.id, label: c.name }))}
              />
            </FilterClear>
          </label>
        </div>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Price stage</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, priceStage: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.priceStage}
                onChange={(id) => setDraft((d) => ({ ...d, priceStage: id }))}
                options={[
                  { id: String(PRICE_STAGE.line), label: priceStageLabel(PRICE_STAGE.line) },
                  { id: String(PRICE_STAGE.promo), label: priceStageLabel(PRICE_STAGE.promo) },
                  { id: String(PRICE_STAGE.closeOut), label: priceStageLabel(PRICE_STAGE.closeOut) },
                ]}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Active</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, active: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.active}
                onChange={(id) => setDraft((d) => ({ ...d, active: id }))}
                options={[
                  { id: "1", label: "Active" },
                  { id: "0", label: "Inactive" },
                ]}
              />
            </FilterClear>
          </label>
        </div>
        <div>
          <span className="mb-1 block text-stone-500">Availability</span>
          <FilterClear onClear={() => setDraft((d) => ({ ...d, availability: "" }))}>
            <AvailabilityPicker
              formFields={false}
              seasons={orderedSeasons}
              value={draft.availability || null}
              onChange={(next) =>
                setDraft((d) => ({ ...d, availability: next ?? "" }))
              }
            />
          </FilterClear>
        </div>
      </DockedFilterPanel>

      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">No merchandise products yet.</p>
      ) : (
        <ProductsTable
          rows={filtered}
          canEdit={canEdit}
          seasons={seasons}
          collections={collections}
          resumeId={resumeId}
          focusId={focusId}
          focusNonce={focusNonce}
          templates={templates}
        />
      )}
    </>
  );
}
