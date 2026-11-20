"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, PageTitle } from "@/components/ui";
import { FitPage } from "@/components/list/FitList";
import { ComboBox } from "@/components/ComboBox";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { SHIP_AT_ONCE } from "@/lib/customer-order";
import { DraftOrdersTable } from "./DraftOrdersTable";
import { DraftOrderPanel } from "./DraftOrderPanel";
import { createProposal } from "./actions";
import { BLANK_ORDER_HEADER, OrderHeaderCard } from "../customer-orders/NewOrderForm";
import type { CatalogChoice, ChargeChoice, SetItem } from "../customer-orders/OrderProductsPanel";
import type { DraftChoice, DraftMethod, DraftOrderLine, DraftOrderRow, ProposalChoices } from "./types";

type Filters = {
  orderNo: string;
  customerId: string;
  season: string;
  status: string;
};

const EMPTY: Filters = { orderNo: "", customerId: "", season: "", status: "" };
const field = "w-full rounded border py-1 pr-6 pl-2";

const STATUS = [
  { id: "draft", label: "Draft" },
  { id: "submitted", label: "Submitted" },
  { id: "accepted", label: "Accepted" },
];

function active(filters: Filters) {
  return Boolean(filters.orderNo.trim() || filters.customerId || filters.season || filters.status);
}

export function DraftOrdersWorkspace({
  rows,
  lines,
  canAct,
  choices,
  setItems,
  catalog,
  charges,
  terms,
  shipmentMethods,
  salesReps,
}: {
  rows: DraftOrderRow[];
  lines: DraftOrderLine[];
  canAct: boolean;
  choices: ProposalChoices | null;
  setItems: SetItem[];
  catalog: CatalogChoice[];
  charges: ChargeChoice[];
  terms: DraftChoice[];
  shipmentMethods: DraftMethod[];
  salesReps: DraftChoice[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [adding, setAdding] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const openRow = rows.find((row) => row.id === openId) ?? null;
  const orderNoEntered = Boolean(draft.orderNo.trim());

  const filtered = useMemo(() => {
    const orderNo = applied.orderNo.trim().toLocaleLowerCase("en");
    return rows.filter((row) => {
      if (orderNo && !String(row.request_no).toLocaleLowerCase("en").includes(orderNo)) return false;
      if (applied.customerId && row.customer_id !== applied.customerId) return false;
      if (applied.season && row.future_season !== applied.season) return false;
      if (applied.status && row.status !== applied.status) return false;
      return true;
    });
  }, [rows, applied]);

  // Select the new proposal once the refreshed list has it.
  useEffect(() => {
    if (!createdId || !rows.some((row) => row.id === createdId)) return;
    if (filtered.some((row) => row.id === createdId)) {
      setFocusId(createdId);
      setFocusNonce((nonce) => nonce + 1);
    }
    setCreatedId(null);
  }, [createdId, rows, filtered]);

  const customers = useMemo(() => {
    const seen = new Set<string>();
    const options: { id: string; label: string }[] = [];
    for (const row of rows) {
      if (seen.has(row.customer_id)) continue;
      seen.add(row.customer_id);
      options.push({ id: row.customer_id, label: row.customer });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
  }, [rows]);

  const seasons = useMemo(() => {
    const names = new Set<string>();
    for (const row of rows) if (row.future_season) names.add(row.future_season);
    if (!names.has(SHIP_AT_ONCE) && rows.some((row) => row.future_season === SHIP_AT_ONCE)) {
      names.add(SHIP_AT_ONCE);
    }
    return [...names]
      .sort((a, b) => {
        if (a === SHIP_AT_ONCE) return -1;
        if (b === SHIP_AT_ONCE) return 1;
        return a.localeCompare(b, "en", { sensitivity: "base" });
      })
      .map((name) => ({ id: name, label: name }));
  }, [rows]);

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setComboKey((key) => key + 1);
  }

  function findByOrderNo() {
    const text = draft.orderNo.trim().toLocaleLowerCase("en");
    if (!text) return;
    const row = filtered.find((item) => String(item.request_no).toLocaleLowerCase("en") === text);
    if (!row) return;
    setFocusId(row.id);
    setFocusNonce((nonce) => nonce + 1);
    setFilterOpen(false);
  }

  return (
    <>
      <FitPage>
        <PageTitle
          title="Draft orders"
          actions={
            <button type="button" className={filterToggleClass(active(applied))} onClick={() => setFilterOpen(true)}>
              Filter
            </button>
          }
        />
        {choices ? (
          <div className="shrink-0">
            <Btn type="button" onClick={() => setAdding(true)}>
              Add proposal
            </Btn>
          </div>
        ) : null}
        <DraftOrdersTable
          rows={filtered}
          lines={lines}
          canAct={canAct}
          choices={choices}
          focusId={focusId}
          focusNonce={focusNonce}
          terms={terms}
          shipmentMethods={shipmentMethods}
          salesReps={salesReps}
          onOpen={setOpenId}
        />
      </FitPage>
      <DockedFilterPanel
        open={filterOpen}
        comboKey={comboKey}
        onClose={() => setFilterOpen(false)}
        onApply={() => {
          setApplied(draft);
          setFilterOpen(false);
        }}
        onReset={reset}
      >
        <label className="block">
          <span className="mb-1 block text-stone-500">PO No</span>
          <FilterClear
            goVisible={orderNoEntered}
            onGo={findByOrderNo}
            onClear={() => setDraft((current) => ({ ...current, orderNo: "" }))}
          >
            <input
              className={`w-full rounded border py-1 pl-2 ${orderNoEntered ? "pr-10" : "pr-6"}`}
              value={draft.orderNo}
              onChange={(event) => setDraft((current) => ({ ...current, orderNo: event.target.value }))}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Customer</span>
          <FilterClear onClear={() => setDraft((current) => ({ ...current, customerId: "" }))}>
            <ComboBox
              allowEmpty
              placeholder="Customer"
              className={field}
              value={draft.customerId}
              onChange={(id) => setDraft((current) => ({ ...current, customerId: id }))}
              options={customers}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Season</span>
          <FilterClear onClear={() => setDraft((current) => ({ ...current, season: "" }))}>
            <ComboBox
              allowEmpty
              placeholder="Season"
              className={field}
              value={draft.season}
              onChange={(id) => setDraft((current) => ({ ...current, season: id }))}
              options={seasons}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Status</span>
          <FilterClear onClear={() => setDraft((current) => ({ ...current, status: "" }))}>
            <ComboBox
              allowEmpty
              placeholder="Status"
              className={field}
              value={draft.status}
              onChange={(id) => setDraft((current) => ({ ...current, status: id }))}
              options={STATUS}
            />
          </FilterClear>
        </label>
      </DockedFilterPanel>
      {adding && choices ? (
        <OrderHeaderCard
          title="New proposal"
          proposal
          initial={BLANK_ORDER_HEADER}
          shipSnapshot={false}
          billSnapshot={false}
          terms={choices.terms}
          customers={choices.customers}
          addresses={choices.addresses}
          shipmentMethods={choices.shipmentMethods}
          transmissionMethods={[]}
          seasons={choices.seasons}
          onClose={() => setAdding(false)}
          onSave={async (formData) => {
            const result = await createProposal(formData);
            if (result.error || !result.id) return result.error || "Could not start the proposal.";
            setCreatedId(result.id);
            router.refresh();
          }}
        />
      ) : null}
      <DraftOrderPanel
        open={openId != null}
        onClose={() => setOpenId(null)}
        order={openRow}
        lines={lines}
        setItems={setItems}
        catalog={catalog}
        charges={charges}
      />
    </>
  );
}
