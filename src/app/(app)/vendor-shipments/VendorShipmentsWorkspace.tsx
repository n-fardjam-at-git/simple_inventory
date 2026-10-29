"use client";

import { DismissNote } from "@/components/DismissNote";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageTitle, Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { createVendorShipment } from "./actions";
import {
  VendorShipmentsTable,
  type VendorShipmentRow,
} from "./VendorShipmentsTable";
import {
  ShipmentDetailsPanel,
  type CatalogCutting,
  type CatalogCuttingProduct,
} from "./ShipmentDetailsPanel";
import type { CuttingViewRow } from "./types";

type Vendor = { id: string; name: string; is_active?: boolean };

type Filters = {
  shipmentNo: string;
  vendorId: string;
  posted: string;
  receivedFrom: string;
  receivedTo: string;
  airWay: string;
};

const EMPTY: Filters = {
  shipmentNo: "",
  vendorId: "",
  posted: "",
  receivedFrom: "",
  receivedTo: "",
  airWay: "",
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

function applyFilters(rows: VendorShipmentRow[], f: Filters) {
  return rows.filter((r) => {
    if (!contains(String(r.shipment_num), f.shipmentNo)) return false;
    if (f.vendorId && r.vendor_id !== f.vendorId) return false;
    if (f.posted === "yes" && !r.posted) return false;
    if (f.posted === "no" && r.posted) return false;
    if (!inDateRange(r.received_date, f.receivedFrom, f.receivedTo)) return false;
    if (!contains(r.air_way_no, f.airWay)) return false;
    return true;
  });
}

export function VendorShipmentsWorkspace({
  rows,
  vendors,
  today,
  lines,
  catalogCuttings,
  catalogProducts,
}: {
  rows: VendorShipmentRow[];
  vendors: Vendor[];
  today: string;
  lines: CuttingViewRow[];
  catalogCuttings: CatalogCutting[];
  catalogProducts: CatalogCuttingProduct[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [addErr, setAddErr] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => applyFilters(rows, applied), [rows, applied]);
  const isFiltered = Object.values(applied).some((v) => v.trim());
  const shipmentNoEntered = Boolean(draft.shipmentNo.trim());
  const openRow = rows.find((r) => r.id === openId) ?? null;

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setComboKey((n) => n + 1);
  }

  function findByShipmentNo() {
    const t = draft.shipmentNo.trim().toLocaleLowerCase("en");
    if (!t) return;
    const row = filtered.find((r) => String(r.shipment_num).toLocaleLowerCase("en") === t);
    if (!row) return;
    setFocusId(row.id);
    setFocusNonce((n) => n + 1);
    setFilterOpen(false);
  }

  return (
    <>
      <PageTitle
        title="Vendor shipments"
        actions={
          <button
            type="button"
            className={filterToggleClass(isFiltered)}
            onClick={() => setFilterOpen(true)}
          >
            {isFiltered ? "Filtered" : "Filter"}
          </button>
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
            <span className="mb-1 block text-stone-500">Shipment No</span>
            <FilterClear
              goVisible={shipmentNoEntered}
              onGo={findByShipmentNo}
              onClear={() => setDraft((d) => ({ ...d, shipmentNo: "" }))}
            >
              <input
                className={`w-full rounded border py-1 pl-2 ${shipmentNoEntered ? "pr-10" : "pr-6"}`}
                value={draft.shipmentNo}
                onChange={(e) => setDraft((d) => ({ ...d, shipmentNo: e.target.value }))}
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
        </div>
        <div className="mt-3 flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Posted</span>
            <select
              className={field}
              value={draft.posted}
              onChange={(e) => setDraft((d) => ({ ...d, posted: e.target.value }))}
            >
              <option value="">Any</option>
              <option value="no">Open</option>
              <option value="yes">Posted</option>
            </select>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Air way</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, airWay: "" }))}>
              <input
                className={field}
                value={draft.airWay}
                onChange={(e) => setDraft((d) => ({ ...d, airWay: e.target.value }))}
              />
            </FilterClear>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Received from</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, receivedFrom: "" }))}>
              <input
                type="date"
                className={field}
                value={draft.receivedFrom}
                onChange={(e) => setDraft((d) => ({ ...d, receivedFrom: e.target.value }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Received to</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, receivedTo: "" }))}>
              <input
                type="date"
                className={field}
                value={draft.receivedTo}
                onChange={(e) => setDraft((d) => ({ ...d, receivedTo: e.target.value }))}
              />
            </FilterClear>
          </label>
        </div>
      </DockedFilterPanel>

      <FitPage>
        <VendorShipmentsTable
          rows={filtered}
          vendors={vendors}
          onOpen={(id) => setOpenId(id)}
          focusId={focusId}
          focusNonce={focusNonce}
        />
        <AddForm
          action={async (formData) => {
            const message = await createVendorShipment(formData);
            if (typeof message === "string" && message) {
              setAddErr(message);
              return message;
            }
            setAddErr(null);
            router.refresh();
          }}
          className="flex shrink-0 flex-wrap items-center gap-2 text-sm"
        >
          <ComboBox
            name="vendor_id"
            required
            placeholder="Vendor"
            options={vendors
              .filter((v) => v.is_active !== false)
              .map((v) => ({ id: v.id, label: v.name }))}
          />
          <input
            name="received_date"
            type="date"
            required
            defaultValue={today}
            aria-label="Date received"
            className="rounded border px-2 py-1"
          />
          <input
            name="air_way_no"
            placeholder="Air way no"
            className="rounded border px-2 py-1"
          />
          <Btn type="submit">Add</Btn>
          {addErr ? <DismissNote onDismiss={() => setAddErr(null)}>{addErr}</DismissNote> : null}
        </AddForm>
      </FitPage>
      <ShipmentDetailsPanel
        open={openId != null}
        onClose={() => setOpenId(null)}
        shipment={openRow}
        lines={lines}
        catalogCuttings={catalogCuttings}
        catalogProducts={catalogProducts}
      />
    </>
  );
}
