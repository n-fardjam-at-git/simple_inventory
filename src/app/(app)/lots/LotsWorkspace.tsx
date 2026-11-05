"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { PageTitle, Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";
import { addLot } from "@/app/(app)/models-actions";
import { LotsTable, type LotRow, type Opt } from "./LotsTable";
import { LotAddFields } from "./LotAddFields";

type Filters = {
  lotNo: string;
  article: string;
  colorNum: string;
  colorId: string;
  patternId: string;
  contentId: string;
  brandId: string;
};

const EMPTY: Filters = {
  lotNo: "",
  article: "",
  colorNum: "",
  colorId: "",
  patternId: "",
  contentId: "",
  brandId: "",
};

function FilterClear({
  onClear,
  onGo,
  goVisible = false,
  children,
}: {
  onClear: () => void;
  onGo?: () => void;
  goVisible?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative" data-clear-wrap="">
      {children}
      {goVisible && onGo ? (
        <button
          type="button"
          className="absolute top-1/2 right-6 z-10 -translate-y-1/2 px-0.5 text-sm leading-none text-stone-400 hover:text-stone-700"
          aria-label="Find"
          title="Find"
          onClick={onGo}
        >
          ←
        </button>
      ) : null}
      <button
        type="button"
        data-clear-btn=""
        className="absolute top-1/2 right-1 z-10 -translate-y-1/2 px-0.5 text-sm leading-none text-stone-400 hover:text-stone-700"
        aria-label="Clear"
        onClick={onClear}
      >
        ×
      </button>
    </div>
  );
}

function contains(hay: string | null | undefined, needle: string) {
  const q = needle.trim().toLocaleLowerCase("en");
  if (!q) return true;
  return (hay ?? "").toLocaleLowerCase("en").includes(q);
}

function lotHints(lotNo: string, rows: LotRow[]) {
  const t = lotNo.trim();
  if (!t) return { article: "", colorNum: "" };
  const found = rows.find(
    (r) => r.lot_no.toLocaleLowerCase("en") === t.toLocaleLowerCase("en"),
  );
  if (found) {
    return { article: found.article ?? "", colorNum: found.color_num ?? "" };
  }
  const parts = t.split("-");
  return { article: parts[0] ?? "", colorNum: parts[1] ?? "" };
}

function applyFilters(rows: LotRow[], f: Filters) {
  return rows.filter(
    (r) =>
      contains(r.lot_no, f.lotNo) &&
      contains(r.article, f.article) &&
      contains(r.color_num, f.colorNum) &&
      (!f.colorId || r.color_id === f.colorId) &&
      (!f.patternId || r.pattern_id === f.patternId) &&
      (!f.contentId || r.content_id === f.contentId) &&
      (!f.brandId || r.brand_id === f.brandId),
  );
}

export function LotsWorkspace({
  rows,
  brands,
  colors,
  patterns,
  contents,
}: {
  rows: LotRow[];
  brands: { id: string; name: string }[];
  colors: Opt[];
  patterns: Opt[];
  contents: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [headerBottom, setHeaderBottom] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const filtered = useMemo(() => applyFilters(rows, applied), [rows, applied]);
  const isFiltered = Object.values(applied).some((v) => v.trim());
  const lotEntered = Boolean(draft.lotNo.trim());
  const hints = lotHints(draft.lotNo, rows);

  useLayoutEffect(() => {
    const header = document.querySelector("header");
    function measure() {
      setHeaderBottom(header ? Math.round(header.getBoundingClientRect().bottom) : 0);
    }
    measure();
    const ro = header ? new ResizeObserver(measure) : null;
    if (header) ro?.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setComboKey((n) => n + 1);
  }

  return (
    <>
      <PageTitle
        title="Lot numbers"
        className="mb-6"
        actions={
          <button
            type="button"
            className={
              isFiltered
                ? "rounded border border-red-700 bg-red-600/15 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-600/25"
                : "rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
            }
            onClick={() => setOpen(true)}
          >
            {isFiltered ? "Filtered" : "Filter"}
          </button>
        }
      />

      {open ? (
        <button
          type="button"
          className="fixed right-0 bottom-0 left-0 z-40 bg-transparent"
          style={{ top: headerBottom }}
          aria-label="Close filter"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed bottom-0 left-0 z-50 flex w-[30%] flex-col bg-slate-100 p-4 shadow-[8px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
          open ? "translate-x-0" : "pointer-events-none -translate-x-full"
        }`}
        style={{ top: headerBottom }}
        aria-hidden={!open}
      >
        <div className="dock-panel flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Filter</h2>
          <button
            type="button"
            className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(
              draft.lotNo.trim() ? { ...draft, article: "", colorNum: "" } : draft,
            );
          }}
        >
          <div key={comboKey} className="flex-1 space-y-3 overflow-auto text-sm">
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-stone-500">Brand</span>
                <FilterClear onClear={() => setDraft((d) => ({ ...d, brandId: "" }))}>
                  <ComboBox
                    allowEmpty
                    className="w-full rounded border py-1 pr-6 pl-2"
                    value={draft.brandId}
                    onChange={(id) => setDraft((d) => ({ ...d, brandId: id }))}
                    options={brands.map((b) => ({ id: b.id, label: b.name }))}
                  />
                </FilterClear>
              </label>
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-stone-500">Lot No</span>
                <FilterClear
                  goVisible={lotEntered}
                  onGo={() => {
                    const t = draft.lotNo.trim().toLocaleLowerCase("en");
                    const row = filtered.find(
                      (r) => r.lot_no.toLocaleLowerCase("en") === t,
                    );
                    if (!row) return;
                    setFocusId(row.id);
                    setFocusNonce((n) => n + 1);
                    setOpen(false);
                  }}
                  onClear={() => setDraft((d) => ({ ...d, lotNo: "", article: "", colorNum: "" }))}
                >
                  <input
                    className={`w-full rounded border py-1 pl-2 ${lotEntered ? "pr-10" : "pr-6"}`}
                    value={draft.lotNo}
                    onChange={(e) => {
                      const lotNo = e.target.value;
                      setDraft((d) => ({
                        ...d,
                        lotNo,
                        ...(lotNo.trim() ? { article: "", colorNum: "" } : {}),
                      }));
                    }}
                  />
                </FilterClear>
              </label>
            </div>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-stone-500">Article</span>
                {lotEntered ? (
                  <div className="w-full rounded border border-stone-200 bg-stone-50 px-2 py-1 text-stone-400">
                    {hints.article || "\u00a0"}
                  </div>
                ) : (
                  <FilterClear onClear={() => setDraft((d) => ({ ...d, article: "" }))}>
                    <input
                      className="w-full rounded border py-1 pr-6 pl-2"
                      value={draft.article}
                      onChange={(e) => setDraft((d) => ({ ...d, article: e.target.value }))}
                    />
                  </FilterClear>
                )}
              </label>
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-stone-500">Color #</span>
                {lotEntered ? (
                  <div className="w-full rounded border border-stone-200 bg-stone-50 px-2 py-1 text-stone-400">
                    {hints.colorNum || "\u00a0"}
                  </div>
                ) : (
                  <FilterClear onClear={() => setDraft((d) => ({ ...d, colorNum: "" }))}>
                    <input
                      className="w-full rounded border py-1 pr-6 pl-2"
                      value={draft.colorNum}
                      onChange={(e) => setDraft((d) => ({ ...d, colorNum: e.target.value }))}
                    />
                  </FilterClear>
                )}
              </label>
            </div>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-stone-500">Color</span>
                <FilterClear onClear={() => setDraft((d) => ({ ...d, colorId: "" }))}>
                  <ComboBox
                    allowEmpty
                    className="w-full rounded border py-1 pr-6 pl-2"
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
                    className="w-full rounded border py-1 pr-6 pl-2"
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
                    className="w-full rounded border py-1 pr-6 pl-2"
                    value={draft.contentId}
                    onChange={(id) => setDraft((d) => ({ ...d, contentId: id }))}
                    options={contents.map((c) => ({ id: c.id, label: c.name }))}
                  />
                </FilterClear>
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Btn type="submit">Filter</Btn>
            <button
              type="button"
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
              onClick={reset}
            >
              Reset
            </button>
          </div>
        </form>
        </div>
      </aside>

      <FitPage>
        <LotsTable
          rows={filtered}
          brands={brands}
          colors={colors}
          patterns={patterns}
          contents={contents}
          focusId={focusId}
          focusNonce={focusNonce}
        />
        <AddForm action={addLot} className="flex shrink-0 flex-wrap gap-2 text-sm">
          <LotAddFields
            lots={rows.map((l) => ({
              lot_no: l.lot_no,
              article: l.article,
              color_num: l.color_num,
              brand_id: l.brand_id,
              pattern_id: l.pattern_id,
              content_id: l.content_id,
            }))}
            brands={brands}
            colors={colors}
            patterns={patterns}
            contents={contents}
          />
          <Btn type="submit">Add</Btn>
        </AddForm>
      </FitPage>
    </>
  );
}
