"use client";

import { useMemo, useState } from "react";
import { PageTitle, Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { createCuttingOrder } from "./actions";
import { CuttingOrdersTable, type CuttingOrderRow } from "./CuttingOrdersTable";
import {
  OrderDetailsPanel,
  type CatalogLot,
  type CatalogProduct,
  type LotLookup,
  type SetItem,
} from "./OrderDetailsPanel";
import type { CatalogModel, ChartDim } from "./NewOrderProductPopup";
import type { SeasonRow } from "@/lib/season";
import type { CuttingOrderProductRow } from "./CuttingOrderProductsTable";
import type { CuttingOrderLotRow } from "./CuttingOrderLotsTable";

type Vendor = { id: string; name: string; is_active?: boolean };
type Brand = { id: string; name: string; is_active?: boolean };

type Filters = {
  orderNo: string;
  vendorId: string;
  brandId: string;
  status: string;
  submitted: string;
  arrivalFrom: string;
  arrivalTo: string;
  poNo: string;
};

const EMPTY: Filters = {
  orderNo: "",
  vendorId: "",
  brandId: "",
  status: "",
  submitted: "",
  arrivalFrom: "",
  arrivalTo: "",
  poNo: "",
};

const field = "w-full rounded border py-1 pr-6 pl-2";

function contains(hay: string | null | undefined, needle: string) {
  const q = needle.trim().toLocaleLowerCase("en");
  if (!q) return true;
  return (hay ?? "").toLocaleLowerCase("en").includes(q);
}

function inDateRange(value: string | null | undefined, from: string, to: string) {
  if (!from.trim() && !to.trim()) return true;
  if (!value) return false;
  if (from.trim() && value < from.trim()) return false;
  if (to.trim() && value > to.trim()) return false;
  return true;
}

function applyFilters(rows: CuttingOrderRow[], f: Filters) {
  return rows.filter((r) => {
    if (!contains(String(r.order_num), f.orderNo)) return false;
    if (f.vendorId && r.vendor_id !== f.vendorId) return false;
    if (f.brandId && r.brand_id !== f.brandId) return false;
    if (f.status === "open" && !r.status) return false;
    if (f.status === "closed" && r.status) return false;
    if (f.submitted === "yes" && r.date_submitted == null) return false;
    if (f.submitted === "no" && r.date_submitted != null) return false;
    if (!inDateRange(r.arrival_date, f.arrivalFrom, f.arrivalTo)) return false;
    if (!contains(r.reference, f.poNo)) return false;
    return true;
  });
}

export function CuttingOrdersWorkspace({
  rows,
  vendors,
  brands,
  setItems,
  productLines,
  orderLots,
  catalogProducts,
  catalogLots,
  colors,
  patterns,
  contents,
  models,
  sizes,
  drops,
  seasons,
  collections,
}: {
  rows: CuttingOrderRow[];
  vendors: Vendor[];
  brands: Brand[];
  setItems: SetItem[];
  productLines: CuttingOrderProductRow[];
  orderLots: CuttingOrderLotRow[];
  catalogProducts: CatalogProduct[];
  catalogLots: CatalogLot[];
  colors: LotLookup[];
  patterns: LotLookup[];
  contents: LotLookup[];
  models: CatalogModel[];
  sizes: ChartDim[];
  drops: ChartDim[];
  seasons: SeasonRow[];
  collections: { id: string; name: string }[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const filtered = useMemo(() => applyFilters(rows, applied), [rows, applied]);
  const isFiltered = Object.values(applied).some((v) => v.trim());
  const orderNoEntered = Boolean(draft.orderNo.trim());

  const openRow = rows.find((r) => r.id === openId) ?? null;
  const openLines = productLines.filter((l) => l.cutting_order_id === openId);
  const openLots = orderLots.filter((l) => l.cutting_order_id === openId);

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setComboKey((n) => n + 1);
  }

  function findByOrderNo() {
    const t = draft.orderNo.trim().toLocaleLowerCase("en");
    if (!t) return;
    const row = filtered.find((r) => String(r.order_num).toLocaleLowerCase("en") === t);
    if (!row) return;
    setFocusId(row.id);
    setFocusNonce((n) => n + 1);
    setFilterOpen(false);
  }

  return (
    <>
      <PageTitle
        title="Cutting orders"
        actions={
          rows.length ? (
            <button
              type="button"
              className={filterToggleClass(isFiltered)}
              onClick={() => setFilterOpen(true)}
            >
              {isFiltered ? "Filtered" : "Filter"}
            </button>
          ) : null
        }
      />

      <DockedFilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => setApplied(draft)}
        onReset={reset}
        comboKey={comboKey}
      >
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Order No</span>
            <FilterClear
              goVisible={orderNoEntered}
              onGo={findByOrderNo}
              onClear={() => setDraft((d) => ({ ...d, orderNo: "" }))}
            >
              <input
                className={`w-full rounded border py-1 pl-2 ${orderNoEntered ? "pr-10" : "pr-6"}`}
                value={draft.orderNo}
                onChange={(e) => setDraft((d) => ({ ...d, orderNo: e.target.value }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Vendor</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, vendorId: "" }))}>
              <ComboBox
                allowEmpty
                className={field}
                value={draft.vendorId}
                onChange={(id) => setDraft((d) => ({ ...d, vendorId: id }))}
                options={vendors.map((v) => ({ id: v.id, label: v.name }))}
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
            <span className="mb-1 block text-stone-500">Status</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, status: "" }))}>
              <select
                className={field}
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
              >
                <option value="" />
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">PO No</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, poNo: "" }))}>
              <input
                className={field}
                value={draft.poNo}
                onChange={(e) => setDraft((d) => ({ ...d, poNo: e.target.value }))}
              />
            </FilterClear>
          </label>
        </div>
        <div>
          <span className="mb-1 block text-stone-500">Submitted</span>
          <FilterClear onClear={() => setDraft((d) => ({ ...d, submitted: "" }))}>
            <div className="flex flex-wrap gap-3 py-1 pr-6 text-sm">
              <label>
                <input
                  type="radio"
                  className="mr-1"
                  name="filter-submitted"
                  checked={draft.submitted === "yes"}
                  onChange={() => setDraft((d) => ({ ...d, submitted: "yes" }))}
                />
                Submitted
              </label>
              <label>
                <input
                  type="radio"
                  className="mr-1"
                  name="filter-submitted"
                  checked={draft.submitted === "no"}
                  onChange={() => setDraft((d) => ({ ...d, submitted: "no" }))}
                />
                In progress
              </label>
            </div>
          </FilterClear>
        </div>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Arrival from</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, arrivalFrom: "" }))}>
              <input
                type="date"
                className={field}
                value={draft.arrivalFrom}
                onChange={(e) => setDraft((d) => ({ ...d, arrivalFrom: e.target.value }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Arrival to</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, arrivalTo: "" }))}>
              <input
                type="date"
                className={field}
                value={draft.arrivalTo}
                onChange={(e) => setDraft((d) => ({ ...d, arrivalTo: e.target.value }))}
              />
            </FilterClear>
          </label>
        </div>
      </DockedFilterPanel>

      <FitPage>
        <CuttingOrdersTable
          rows={filtered}
          vendors={vendors}
          brands={brands}
          onOpen={(id) => setOpenId(id)}
          focusId={focusId}
          focusNonce={focusNonce}
        />
        <AddForm action={createCuttingOrder} className="flex shrink-0 flex-wrap gap-2 text-sm">
          <ComboBox
            name="vendor_id"
            required
            placeholder="Vendor"
            options={vendors.filter((v) => v.is_active).map((v) => ({ id: v.id, label: v.name }))}
          />
          <ComboBox
            name="brand_id"
            required
            placeholder="Brand"
            options={brands.filter((b) => b.is_active).map((b) => ({ id: b.id, label: b.name }))}
          />
          <input name="date_submitted" type="date" className="rounded border px-2 py-1" aria-label="Date submitted" />
          <input name="arrival_date" type="date" required className="rounded border px-2 py-1" />
          <input name="reference" placeholder="PO No" className="rounded border px-2 py-1" />
          <Btn type="submit">Add</Btn>
        </AddForm>
      </FitPage>
      <OrderDetailsPanel
        open={openId != null}
        onClose={() => setOpenId(null)}
        order={openRow}
        setItems={setItems}
        productLines={openLines}
        orderLots={openLots}
        catalogProducts={catalogProducts}
        catalogLots={catalogLots}
        colors={colors}
        patterns={patterns}
        contents={contents}
        models={models}
        sizes={sizes}
        drops={drops}
        seasons={seasons}
        collections={collections}
      />
    </>
  );
}
