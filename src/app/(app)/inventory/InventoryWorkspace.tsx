"use client";

import { useMemo, useState } from "react";
import { ComboBox } from "@/components/ComboBox";
import { INSTOCK, sortSeasonsDesc, type SeasonRow } from "@/lib/season";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { InventoryList } from "./InventoryList";
import type { InventoryBoard } from "./InventoryMatrixCard";

type Opt = { id: string; name: string };

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
  availability: "",
  active: "",
};

function contains(hay: string | null | undefined, needle: string) {
  const q = needle.trim().toLocaleLowerCase("en");
  if (!q) return true;
  return (hay ?? "").toLocaleLowerCase("en").includes(q);
}

function applyFilters(boards: InventoryBoard[], f: Filters) {
  return boards.filter((b) => {
    if (!contains(b.title, f.name)) return false;
    if (f.collectionId && b.collectionId !== f.collectionId) return false;
    if (f.brandId && b.brandId !== f.brandId) return false;
    if (f.itemId && b.itemId !== f.itemId) return false;
    if (f.modelId && b.modelId !== f.modelId) return false;
    if (!contains(b.lotNo, f.lotNo)) return false;
    if (f.colorId && b.colorId !== f.colorId) return false;
    if (f.patternId && b.patternId !== f.patternId) return false;
    if (f.contentId && b.contentId !== f.contentId) return false;
    if (f.availability && (b.availability ?? "") !== f.availability) return false;
    if (f.active === "1" && !b.isActive) return false;
    if (f.active === "0" && b.isActive) return false;
    return true;
  });
}

const field = "w-full rounded border py-1 pr-6 pl-2";

const ORDER = {
  catalog: "catalog",
  onhandDesc: "onhand-desc",
  onhandAsc: "onhand-asc",
} as const;

function grandTotal(board: InventoryBoard) {
  return board.cells.reduce((sum, c) => sum + Number(c.qty ?? 0), 0);
}

function orderBoards(boards: InventoryBoard[], order: string) {
  if (order === ORDER.onhandDesc) {
    return [...boards].sort((a, b) => grandTotal(b) - grandTotal(a));
  }
  if (order === ORDER.onhandAsc) {
    return [...boards].sort((a, b) => grandTotal(a) - grandTotal(b));
  }
  return boards;
}

export function InventoryWorkspace({
  boards,
  canEdit,
  seasons,
  collections,
  brands,
  items,
  models,
  colors,
  patterns,
  contents,
}: {
  boards: InventoryBoard[];
  canEdit: boolean;
  seasons: SeasonRow[];
  collections: Opt[];
  brands: Opt[];
  items: Opt[];
  models: Opt[];
  colors: Opt[];
  patterns: Opt[];
  contents: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [order, setOrder] = useState(ORDER.catalog);

  const filtered = useMemo(
    () => orderBoards(applyFilters(boards, applied), order),
    [boards, applied, order],
  );
  const isFiltered = Object.values(applied).some((v) => v.trim());
  const nameEntered = Boolean(draft.name.trim());
  const orderedSeasons = sortSeasonsDesc(seasons);
  const nameOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const b of boards) {
      const key = b.title.toLocaleLowerCase("en");
      if (!b.title || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: b.title, label: b.title });
    }
    return out;
  }, [boards]);

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setComboKey((n) => n + 1);
  }

  function findByName() {
    const t = draft.name.trim().toLocaleLowerCase("en");
    if (!t) return;
    const row = filtered.find((b) => b.title.toLocaleLowerCase("en") === t);
    if (!row) return;
    setFocusId(row.productId);
    setFocusNonce((n) => n + 1);
    setOpen(false);
  }

  return (
    <>
      {boards.length ? (
        <div className="mb-2 flex items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-600">Sort by totals</span>
            <div className="inline-flex overflow-hidden rounded border border-stone-300 bg-white">
              <button
                type="button"
                className={`px-2.5 py-1.5 text-sm leading-none ${
                  order === ORDER.onhandAsc
                    ? "bg-stone-900 text-white"
                    : "text-stone-800 hover:bg-stone-50"
                }`}
                aria-label="Sort by totals low to high"
                title="Low to high"
                onClick={() => setOrder(ORDER.onhandAsc)}
              >
                ↑
              </button>
              <button
                type="button"
                className={`border-l border-stone-300 px-2.5 py-1.5 text-sm leading-none ${
                  order === ORDER.onhandDesc
                    ? "bg-stone-900 text-white"
                    : "text-stone-800 hover:bg-stone-50"
                }`}
                aria-label="Sort by totals high to low"
                title="High to low"
                onClick={() => setOrder(ORDER.onhandDesc)}
              >
                ↓
              </button>
              {order !== ORDER.catalog ? (
                <button
                  type="button"
                  className="border-l border-stone-300 px-2.5 py-1.5 text-sm leading-none text-stone-800 hover:bg-stone-50"
                  aria-label="Clear sort"
                  title="Clear"
                  onClick={() => setOrder(ORDER.catalog)}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className={filterToggleClass(isFiltered)}
            onClick={() => setOpen(true)}
          >
            {isFiltered ? "Filtered" : "Filter"}
          </button>
        </div>
      ) : null}

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
        <div className="flex items-end gap-2">
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
          <label className="inline-flex shrink-0 items-center gap-1.5">
            <input
              type="checkbox"
              checked={draft.availability === INSTOCK}
              onChange={(e) =>
                setDraft((d) => ({ ...d, availability: e.target.checked ? INSTOCK : "" }))
              }
            />
            Instock
          </label>
          {draft.availability === INSTOCK ? null : (
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-stone-500">Season</span>
              <FilterClear onClear={() => setDraft((d) => ({ ...d, availability: "" }))}>
                <ComboBox
                  allowEmpty
                  className={field}
                  placeholder="Season"
                  value={draft.availability}
                  onChange={(id) => setDraft((d) => ({ ...d, availability: id }))}
                  options={orderedSeasons.map((s) => ({ id: s.season, label: s.season }))}
                />
              </FilterClear>
            </label>
          )}
        </div>
      </DockedFilterPanel>

      {boards.length === 0 ? (
        <p className="text-sm text-stone-500">No merchandise products yet.</p>
      ) : (
        <InventoryList
          boards={filtered}
          canEdit={canEdit}
          focusId={focusId}
          focusNonce={focusNonce}
        />
      )}
    </>
  );
}
