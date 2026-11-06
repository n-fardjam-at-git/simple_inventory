"use client";

import { useMemo, useState } from "react";
import { FitPage } from "@/components/list/FitList";
import { PageTitle } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { NumericInput } from "@/components/NumericInput";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { customerPickLabel } from "@/lib/customer";
import type { SeasonRow } from "@/lib/season";
import { CustomerOrdersTable, type CustomerOrderRow } from "./CustomerOrdersTable";
import { NewOrderForm } from "./NewOrderForm";
import {
  OrderProductsPanel,
  type CatalogChoice,
  type ChargeChoice,
  type OrderProductLine,
  type SetItem,
} from "./OrderProductsPanel";

type Customer = {
  id: string;
  account_no: number;
  company_name: string;
  account_number: string | null;
  term: string | null;
};
type Address = {
  id: string;
  customer_id: string;
  address_type: string;
  location_name: string | null;
  city: string | null;
  address_line1: string | null;
};
type ShipmentMethod = { id: string; shipper: string | null; method: string };
type TransmissionMethod = { id: string; name: string };
type PaymentTerm = { term: string; days_due: number | null };

type Filters = {
  orderNo: string;
  customerId: string;
  openness: string;
  startFrom: string;
  startTo: string;
  leftToShip: string;
};

const EMPTY: Filters = {
  orderNo: "",
  customerId: "",
  openness: "",
  startFrom: "",
  startTo: "",
  leftToShip: "",
};

const OPEN_STATUS = new Set(["pending", "approved", "picking", "back_order", "short_shipped"]);

const field = "w-full rounded border py-1 pr-6 pl-2";

const SORT = {
  orderNo: "order-no",
  leftAsc: "left-asc",
  leftDesc: "left-desc",
} as const;

function sortRows(rows: CustomerOrderRow[], sort: string) {
  if (sort === SORT.leftAsc) {
    return [...rows].sort((a, b) => a.left_to_ship - b.left_to_ship || b.order_no - a.order_no);
  }
  if (sort === SORT.leftDesc) {
    return [...rows].sort((a, b) => b.left_to_ship - a.left_to_ship || b.order_no - a.order_no);
  }
  return rows;
}

function applyFilters(rows: CustomerOrderRow[], filters: Filters) {
  const orderNo = filters.orderNo.trim().toLocaleLowerCase("en");
  return rows.filter((row) => {
    if (orderNo && !String(row.order_no).toLocaleLowerCase("en").includes(orderNo)) return false;
    if (filters.customerId && row.customer_id !== filters.customerId) return false;
    if (filters.openness === "open" && !OPEN_STATUS.has(row.status)) return false;
    if (filters.openness === "complete" && row.status !== "complete") return false;
    if (filters.startFrom && (!row.start_date || row.start_date < filters.startFrom)) return false;
    if (filters.startTo && (!row.start_date || row.start_date > filters.startTo)) return false;
    if (filters.leftToShip.trim() && row.left_to_ship !== Number(filters.leftToShip)) return false;
    return true;
  });
}

export function CustomerOrdersWorkspace({
  rows,
  customers,
  addresses,
  shipmentMethods,
  transmissionMethods,
  seasons,
  terms,
  lines,
  setItems,
  catalog,
  charges,
}: {
  rows: CustomerOrderRow[];
  customers: Customer[];
  addresses: Address[];
  shipmentMethods: ShipmentMethod[];
  transmissionMethods: TransmissionMethod[];
  seasons: SeasonRow[];
  terms: PaymentTerm[];
  lines: OrderProductLine[];
  setItems: SetItem[];
  catalog: CatalogChoice[];
  charges: ChargeChoice[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [sort, setSort] = useState<string>(SORT.orderNo);
  const filtered = useMemo(
    () => sortRows(applyFilters(rows, applied), sort),
    [rows, applied, sort],
  );
  const isFiltered = Object.values(applied).some((value) => value.trim());
  const orderNoEntered = Boolean(draft.orderNo.trim());
  const order = rows.find((row) => row.id === openId) ?? null;
  const customerOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { id: string; label: string }[] = [];
    for (const customer of customers) {
      seen.add(customer.id);
      options.push({ id: customer.id, label: customerPickLabel(customer) });
    }
    for (const row of rows) {
      if (seen.has(row.customer_id)) continue;
      seen.add(row.customer_id);
      options.push({
        id: row.customer_id,
        label: customerPickLabel({
          account_no: row.account_no ?? 0,
          company_name: row.customer,
          account_number: row.account === "—" ? null : row.account,
        }),
      });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
  }, [customers, rows]);

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setComboKey((key) => key + 1);
  }

  function findByOrderNo() {
    const text = draft.orderNo.trim().toLocaleLowerCase("en");
    if (!text) return;
    const row = filtered.find((item) => String(item.order_no).toLocaleLowerCase("en") === text);
    if (!row) return;
    setFocusId(row.id);
    setFocusNonce((nonce) => nonce + 1);
    setFilterOpen(false);
  }

  return (
    <>
      <FitPage>
        <PageTitle
          title="Customer orders"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-600">Sort by left to ship</span>
                <div className="inline-flex overflow-hidden rounded border border-stone-300 bg-white">
                  <button
                    type="button"
                    className={`px-2.5 py-1.5 text-sm leading-none ${
                      sort === SORT.leftAsc
                        ? "bg-stone-900 text-white"
                        : "text-stone-800 hover:bg-stone-50"
                    }`}
                    aria-label="Sort by left to ship low to high"
                    title="Low to high"
                    onClick={() => setSort(SORT.leftAsc)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={`border-l border-stone-300 px-2.5 py-1.5 text-sm leading-none ${
                      sort === SORT.leftDesc
                        ? "bg-stone-900 text-white"
                        : "text-stone-800 hover:bg-stone-50"
                    }`}
                    aria-label="Sort by left to ship high to low"
                    title="High to low"
                    onClick={() => setSort(SORT.leftDesc)}
                  >
                    ↓
                  </button>
                  {sort !== SORT.orderNo ? (
                    <button
                      type="button"
                      className="border-l border-stone-300 px-2.5 py-1.5 text-sm leading-none text-stone-800 hover:bg-stone-50"
                      aria-label="Clear sort"
                      title="Clear"
                      onClick={() => setSort(SORT.orderNo)}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className={filterToggleClass(isFiltered)}
                onClick={() => setFilterOpen(true)}
              >
                {isFiltered ? "Filtered" : "Filter"}
              </button>
            </div>
          }
        />
        <NewOrderForm
          customers={customers}
          addresses={addresses}
          shipmentMethods={shipmentMethods}
          transmissionMethods={transmissionMethods}
          seasons={seasons}
          terms={terms}
        />
        <CustomerOrdersTable
          rows={filtered}
          customers={customers}
          addresses={addresses}
          shipmentMethods={shipmentMethods}
          transmissionMethods={transmissionMethods}
          seasons={seasons}
          terms={terms}
          lines={lines}
          onOpen={setOpenId}
          focusId={focusId}
          focusNonce={focusNonce}
        />
      </FitPage>
      <OrderProductsPanel
        open={openId != null}
        onClose={() => setOpenId(null)}
        orderId={openId}
        orderNo={order?.order_no ?? null}
        customer={order?.customer ?? null}
        lines={lines.filter((line) => line.customer_order_id === openId)}
        setItems={setItems}
        catalog={catalog}
        charges={charges}
      />
      <DockedFilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => setApplied(draft)}
        onReset={reset}
        comboKey={comboKey}
      >
        <label className="block">
          <span className="mb-1 block text-stone-500">Order no</span>
          <FilterClear
            goVisible={orderNoEntered}
            onGo={findByOrderNo}
            onClear={() => setDraft((current) => ({ ...current, orderNo: "" }))}
          >
            <input
              className={`w-full rounded border py-1 pl-2 ${orderNoEntered ? "pr-10" : "pr-6"}`}
              value={draft.orderNo}
              onChange={(e) => setDraft((current) => ({ ...current, orderNo: e.target.value }))}
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
              options={customerOptions}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Open or complete</span>
          <FilterClear onClear={() => setDraft((current) => ({ ...current, openness: "" }))}>
            <ComboBox
              allowEmpty
              placeholder="Open or complete"
              className={field}
              value={draft.openness}
              onChange={(id) => setDraft((current) => ({ ...current, openness: id }))}
              options={[
                { id: "open", label: "Open" },
                { id: "complete", label: "Complete" },
              ]}
            />
          </FilterClear>
        </label>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Start from</span>
            <FilterClear onClear={() => setDraft((current) => ({ ...current, startFrom: "" }))}>
              <input
                type="date"
                className={field}
                value={draft.startFrom}
                onChange={(e) => setDraft((current) => ({ ...current, startFrom: e.target.value }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Start to</span>
            <FilterClear onClear={() => setDraft((current) => ({ ...current, startTo: "" }))}>
              <input
                type="date"
                className={field}
                value={draft.startTo}
                onChange={(e) => setDraft((current) => ({ ...current, startTo: e.target.value }))}
              />
            </FilterClear>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-stone-500">Left to ship</span>
          <FilterClear onClear={() => setDraft((current) => ({ ...current, leftToShip: "" }))}>
            <NumericInput
              aria-label="Left to ship"
              className={field}
              value={draft.leftToShip}
              onChange={(e) => setDraft((current) => ({ ...current, leftToShip: e.target.value }))}
            />
          </FilterClear>
        </label>
      </DockedFilterPanel>
    </>
  );
}
