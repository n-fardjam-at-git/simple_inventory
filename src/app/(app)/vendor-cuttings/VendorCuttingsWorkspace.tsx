"use client";

import { useState } from "react";
import { PageTitle } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { FitPage } from "@/components/list/FitList";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { VendorCuttingsTable } from "./VendorCuttingsTable";
import { VendorCuttingPanel } from "./VendorCuttingPanel";
import type { VendorCuttingLine, VendorCuttingRow } from "./types";

type Filters = {
  orderId: string;
  status: string;
  submittedFrom: string;
  submittedTo: string;
};

const EMPTY: Filters = { orderId: "", status: "", submittedFrom: "", submittedTo: "" };

function matches(row: VendorCuttingRow, f: Filters) {
  if (f.orderId && row.id !== f.orderId) return false;
  if (f.status === "open" && !row.open) return false;
  if (f.status === "closed" && row.open) return false;
  if (f.submittedFrom && row.date_submitted < f.submittedFrom) return false;
  if (f.submittedTo && row.date_submitted > f.submittedTo) return false;
  return true;
}

export function VendorCuttingsWorkspace({
  rows,
  lines,
}: {
  rows: VendorCuttingRow[];
  lines: VendorCuttingLine[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const openRow = rows.find((r) => r.id === openId) ?? null;
  const filtered = rows.filter((r) => matches(r, applied));
  const isFiltered = Object.values(applied).some((v) => v.trim());
  const orderPicked = Boolean(draft.orderId);
  const orderOptions = rows.map((r) => ({ id: r.id, label: String(r.order_num) }));

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setComboKey((k) => k + 1);
  }

  function findByOrderNo() {
    if (!draft.orderId) return;
    const row = filtered.find((r) => r.id === draft.orderId);
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
        <label className="block">
          <span className="mb-1 block text-stone-500">Cutting No</span>
          <FilterClear
            goVisible={orderPicked}
            onGo={findByOrderNo}
            onClear={() => setDraft((d) => ({ ...d, orderId: "" }))}
          >
            <ComboBox
              allowEmpty
              className={`w-full rounded border py-1 pl-2 ${orderPicked ? "pr-10" : "pr-6"}`}
              value={draft.orderId}
              onChange={(id) => setDraft((d) => ({ ...d, orderId: id }))}
              options={orderOptions}
            />
          </FilterClear>
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-stone-500">Status</span>
          <FilterClear onClear={() => setDraft((d) => ({ ...d, status: "" }))}>
            <select
              className="w-full rounded border py-1 pl-2 pr-6"
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
            >
              <option value="">Any</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </FilterClear>
        </label>
        <div className="mt-3 flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Submitted from</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, submittedFrom: "" }))}>
              <input
                type="date"
                className="w-full rounded border py-1 pl-2 pr-6"
                value={draft.submittedFrom}
                onChange={(e) => setDraft((d) => ({ ...d, submittedFrom: e.target.value }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Submitted to</span>
            <FilterClear onClear={() => setDraft((d) => ({ ...d, submittedTo: "" }))}>
              <input
                type="date"
                className="w-full rounded border py-1 pl-2 pr-6"
                value={draft.submittedTo}
                onChange={(e) => setDraft((d) => ({ ...d, submittedTo: e.target.value }))}
              />
            </FilterClear>
          </label>
        </div>
      </DockedFilterPanel>
      <FitPage>
        {filtered.length === 0 ? (
          <p className="min-h-0 flex-1 text-sm text-stone-500">
            {rows.length === 0 ? "No submitted cuttings yet." : "No cuttings match."}
          </p>
        ) : (
          <VendorCuttingsTable
            rows={filtered}
            onOpen={setOpenId}
            focusId={focusId}
            focusNonce={focusNonce}
          />
        )}
      </FitPage>
      <VendorCuttingPanel
        open={openId != null}
        onClose={() => setOpenId(null)}
        cutting={openRow}
        lines={lines}
      />
    </>
  );
}
