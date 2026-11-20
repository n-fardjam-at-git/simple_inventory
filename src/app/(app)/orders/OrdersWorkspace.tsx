"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FitList, FitPage } from "@/components/list/FitList";
import { SelectableRow, useList } from "@/components/list/ListTable";
import { ComboBox } from "@/components/ComboBox";
import { NumericInput } from "@/components/NumericInput";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { Btn, PageTitle } from "@/components/ui";
import { SysFolder, SysFolderOpen } from "@/components/icons/SysImages";
import { orderStatusLabel, SHIP_AT_ONCE } from "@/lib/customer-order";
import { summarizeOrder } from "@/lib/order-summary";
import { PRODUCT_TYPE } from "@/lib/product-type";
import type { SeasonRow } from "@/lib/season";
import {
  OrderProductsPanel,
  summaryLine,
  type OrderProductLine,
} from "../customer-orders/OrderProductsPanel";
import type { CustomerProcessOrder } from "./types";

type Filters = {
  orderNo: string;
  poNo: string;
  season: string;
  openness: string;
  startFrom: string;
  startTo: string;
  leftToShip: string;
  productIds: string[];
};

const EMPTY: Filters = {
  orderNo: "",
  poNo: "",
  season: "",
  openness: "",
  startFrom: "",
  startTo: "",
  leftToShip: "",
  productIds: [],
};

const OPEN_STATUS = new Set(["pending", "approved", "picking", "back_order", "short_shipped"]);
const field = "w-full rounded border py-1 pr-6 pl-2";

function filtersActive(filters: Filters) {
  return Boolean(
    filters.orderNo.trim() ||
      filters.poNo.trim() ||
      filters.season ||
      filters.openness ||
      filters.startFrom ||
      filters.startTo ||
      filters.leftToShip.trim() ||
      filters.productIds.length,
  );
}

function applyFilters(rows: CustomerProcessOrder[], filters: Filters, lines: OrderProductLine[]) {
  const orderNo = filters.orderNo.trim().toLocaleLowerCase("en");
  const poNo = filters.poNo.trim().toLocaleLowerCase("en");
  const wanted = new Set(filters.productIds);
  const ordersWithProduct = wanted.size
    ? new Set(
        lines.filter((line) => wanted.has(line.product_id)).map((line) => line.customer_order_id),
      )
    : null;
  return rows.filter((row) => {
    if (orderNo && !String(row.order_no).toLocaleLowerCase("en").includes(orderNo)) return false;
    if (poNo && !(row.po_no ?? "").toLocaleLowerCase("en").includes(poNo)) return false;
    if (filters.season && row.future_season !== filters.season) return false;
    if (filters.openness === "open" && !OPEN_STATUS.has(row.status)) return false;
    if (filters.openness === "complete" && row.status !== "complete") return false;
    if (filters.startFrom && (!row.start_date || row.start_date < filters.startFrom)) return false;
    if (filters.startTo && (!row.start_date || row.start_date > filters.startTo)) return false;
    if (filters.leftToShip.trim() && row.left_to_ship !== Number(filters.leftToShip)) return false;
    if (ordersWithProduct && !ordersWithProduct.has(row.id)) return false;
    return true;
  });
}

const GROUP = "overflow-hidden rounded-md border border-stone-300 bg-stone-50";
const GROUP_BODY = "px-3 py-2";
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function OrdersWorkspace({
  rows,
  lines,
  seasons,
}: {
  rows: CustomerProcessOrder[];
  lines: OrderProductLine[];
  seasons: SeasonRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [productPick, setProductPick] = useState("");
  const filtered = useMemo(() => applyFilters(rows, applied, lines), [rows, applied, lines]);
  const selected = filtered.find((row) => row.id === selectedId) ?? null;
  const orderLines = lines.filter((line) => line.customer_order_id === selected?.id);
  const orderNoEntered = Boolean(draft.orderNo.trim());
  const poEntered = Boolean(draft.poNo.trim());
  const seasonOptions = useMemo(() => {
    const names = new Set<string>([SHIP_AT_ONCE]);
    for (const season of seasons) names.add(season.season);
    for (const row of rows) if (row.future_season) names.add(row.future_season);
    return [...names].map((name) => ({ id: name, label: name }));
  }, [seasons, rows]);
  const productOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const line of lines) {
      if (line.type !== PRODUCT_TYPE.merchandise || byId.has(line.product_id)) continue;
      byId.set(line.product_id, line.label);
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
  }, [lines]);

  function resetFilter() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setProductPick("");
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

  function findByPo() {
    const text = draft.poNo.trim().toLocaleLowerCase("en");
    if (!text) return;
    const row = filtered.find((item) => (item.po_no ?? "").toLocaleLowerCase("en") === text);
    if (!row) return;
    setFocusId(row.id);
    setFocusNonce((nonce) => nonce + 1);
    setFilterOpen(false);
  }

  function addProduct() {
    if (!productPick || draft.productIds.includes(productPick)) return;
    setDraft((current) => ({ ...current, productIds: [...current.productIds, productPick] }));
    setProductPick("");
  }

  function openProducts() {
    if (!selected) return;
    setPanelId(selected.id);
  }

  return (
    <>
      <FitPage>
        <PageTitle
          title="Orders"
          actions={
            <button
              type="button"
              className={filterToggleClass(filtersActive(applied))}
              onClick={() => setFilterOpen(true)}
            >
              {filtersActive(applied) ? "Filtered" : "Filter"}
            </button>
          }
        />
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="flex min-h-0 w-1/2 min-w-0 flex-col">
            <FitList
              items={filtered}
              getKey={(row) => row.id}
              focusId={focusId}
              focusNonce={focusNonce}
              stretch
              thead={
                <thead>
                  <Bridge onSelect={setSelectedId} />
                  <tr className="text-stone-500">
                    <th className="py-1">Order</th>
                    <th>PO No</th>
                    <th>Date</th>
                    <th>Start</th>
                    <th>Status</th>
                    <th>Left to ship</th>
                  </tr>
                </thead>
              }
              renderRow={(row) => (
                <SelectableRow id={row.id}>
                  <td className="py-1.5 tabular-nums">{row.order_no}</td>
                  <td>{row.po_no || "—"}</td>
                  <td className="tabular-nums">{row.created_date ?? "—"}</td>
                  <td className="tabular-nums">{row.start_date ?? "—"}</td>
                  <td className={row.status === "approved" ? "text-red-700" : undefined}>
                    {orderStatusLabel(row.status)}
                  </td>
                  <td className="tabular-nums">{row.left_to_ship}</td>
                </SelectableRow>
              )}
            />
          </div>
          <OrderDetails
            order={selected}
            lines={orderLines}
            panelOpen={panelId === selected?.id}
            onOpen={openProducts}
          />
        </div>
      </FitPage>
      <DockedFilterPanel
        open={filterOpen}
        comboKey={comboKey}
        onClose={() => setFilterOpen(false)}
        onApply={() => setApplied(draft)}
        onReset={resetFilter}
      >
        <label className="block">
          <span className="mb-1 block text-stone-500">Order no</span>
          <FilterClear
            goVisible={orderNoEntered}
            onGo={findByOrderNo}
            onClear={() => setDraft((current) => ({ ...current, orderNo: "" }))}
          >
            <input
              aria-label="Order no"
              className={`w-full rounded border py-1 pl-2 ${orderNoEntered ? "pr-10" : "pr-6"}`}
              value={draft.orderNo}
              onChange={(event) => setDraft((current) => ({ ...current, orderNo: event.target.value }))}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">PO No</span>
          <FilterClear
            goVisible={poEntered}
            onGo={findByPo}
            onClear={() => setDraft((current) => ({ ...current, poNo: "" }))}
          >
            <input
              aria-label="PO No"
              className={`w-full rounded border py-1 pl-2 ${poEntered ? "pr-10" : "pr-6"}`}
              value={draft.poNo}
              onChange={(event) => setDraft((current) => ({ ...current, poNo: event.target.value }))}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Season</span>
          <FilterClear onClear={() => setDraft((current) => ({ ...current, season: "" }))}>
            <ComboBox
              allowEmpty
              placeholder="Season"
              aria-label="Season"
              className={field}
              value={draft.season}
              onChange={(id) => setDraft((current) => ({ ...current, season: id }))}
              options={seasonOptions}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Open or complete</span>
          <FilterClear onClear={() => setDraft((current) => ({ ...current, openness: "" }))}>
            <ComboBox
              allowEmpty
              placeholder="Open or complete"
              aria-label="Open or complete"
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
                aria-label="Start from"
                className={field}
                value={draft.startFrom}
                onChange={(event) => setDraft((current) => ({ ...current, startFrom: event.target.value }))}
              />
            </FilterClear>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-stone-500">Start to</span>
            <FilterClear onClear={() => setDraft((current) => ({ ...current, startTo: "" }))}>
              <input
                type="date"
                aria-label="Start to"
                className={field}
                value={draft.startTo}
                onChange={(event) => setDraft((current) => ({ ...current, startTo: event.target.value }))}
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
              onChange={(event) => setDraft((current) => ({ ...current, leftToShip: event.target.value }))}
            />
          </FilterClear>
        </label>
        <div>
          <span className="mb-1 block text-stone-500">Products</span>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ComboBox
                allowEmpty
                placeholder="Product"
                aria-label="Product"
                className={field}
                value={productPick}
                onChange={setProductPick}
                options={productOptions.filter((product) => !draft.productIds.includes(product.id))}
              />
            </div>
            <Btn type="button" onClick={addProduct}>
              Add
            </Btn>
          </div>
          {draft.productIds.length ? (
            <ul className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {draft.productIds.map((id) => {
                const label = productOptions.find((product) => product.id === id)?.label ?? "Product";
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 border-b border-slate-200 px-2 py-1 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 truncate">{label}</span>
                    <button
                      type="button"
                      className="shrink-0 px-1 text-base leading-none text-stone-500 hover:text-stone-800"
                      aria-label={`Remove ${label}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          productIds: current.productIds.filter((productId) => productId !== id),
                        }))
                      }
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </DockedFilterPanel>
      <OrderProductsPanel
        open={panelId != null && panelId === selected?.id}
        onClose={() => setPanelId(null)}
        orderId={selected?.id ?? null}
        orderNo={selected?.order_no ?? null}
        customer={selected?.customer ?? null}
        heading={selected ? `${selected.customer} · Order No ${selected.order_no}` : "Order"}
        lines={orderLines}
        setItems={[]}
        catalog={[]}
        charges={[]}
        readOnly
        showInventory={false}
      />
    </>
  );
}

function Bridge({ onSelect }: { onSelect: (id: string | null) => void }) {
  const { selectedId } = useList();
  useEffect(() => {
    onSelect(selectedId);
  }, [onSelect, selectedId]);
  return null;
}

function OrderDetails({
  order,
  lines,
  panelOpen,
  onOpen,
}: {
  order: CustomerProcessOrder | null;
  lines: OrderProductLine[];
  panelOpen: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="flex min-h-0 w-1/2 min-w-0 flex-col overflow-hidden rounded-lg border border-stone-300 bg-white p-3">
      {order ? (
        <>
          <div className="flex h-[39px] shrink-0 items-end justify-between gap-3 border-b border-stone-300 pb-1">
            <h2 className="min-w-0 truncate text-sm leading-5">
              <span className="font-medium text-stone-900">{order.customer}</span>
              <span className="font-normal text-stone-500"> · Order No {order.order_no}</span>
            </h2>
            <button
              type="button"
              className="group relative inline-flex h-[34px] w-[34px] shrink-0 cursor-pointer rounded text-stone-600 hover:text-stone-900"
              aria-label="Open order"
              title="Open order"
              onClick={onOpen}
            >
              <span className="pointer-events-none absolute right-0 bottom-0 [&_svg]:h-[46px] [&_svg]:w-[46px]">
                {panelOpen ? <SysFolderOpen /> : <SysFolder />}
              </span>
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto pt-3 [&>*]:shrink-0">
            <Section cols={3}>
              <Fact label="PO No" value={order.po_no || "—"} />
              <Fact label="Season" value={order.future_season || "—"} />
              <Fact label="Deliver by" value={order.cancel_date || "—"} />
            </Section>
            <Section title="Terms and shipping" cols={2}>
              <Fact label="Terms" value={order.terms || "—"} />
              <Fact label="Shipping method" value={order.shipping_method || "—"} />
            </Section>
            <div className="grid grid-cols-2 gap-2">
              <Address title="Ship to" lines={order.ship_to} />
              <Address title="Bill to" lines={order.bill_to} />
            </div>
          </div>
          <OrderSummary lines={lines} onOpen={onOpen} />
        </>
      ) : (
        <p className="m-auto text-sm text-stone-500">Select an order.</p>
      )}
    </div>
  );
}

function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">
      {children}
    </h3>
  );
}

function Section({
  title,
  cols,
  children,
}: {
  title?: string;
  cols?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <section className={GROUP}>
      {title ? <GroupHeader>{title}</GroupHeader> : null}
      <div className={GROUP_BODY}>
        {cols ? (
          <dl
            className={`grid ${cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1"} gap-x-3 gap-y-1.5`}
          >
            {children}
          </dl>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-stone-500">{label}</dt>
      <dd className="text-[13px] leading-tight break-words text-stone-900">{value}</dd>
    </div>
  );
}

function Address({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className={GROUP}>
      <GroupHeader>{title}</GroupHeader>
      <div className={GROUP_BODY}>
        {lines.length ? (
          lines.map((line, index) => (
            <p key={index} className="text-[13px] leading-tight text-stone-900">
              {line}
            </p>
          ))
        ) : (
          <p className="text-[13px] text-stone-400">—</p>
        )}
      </div>
    </section>
  );
}

function OrderSummary({ lines, onOpen }: { lines: OrderProductLine[]; onOpen: () => void }) {
  const totals = summarizeOrder(lines.map(summaryLine));
  const rule = "border-b border-stone-200";
  return (
    <section
      className={`${GROUP} mt-2 shrink-0 cursor-pointer hover:border-stone-400`}
      title="Open the order products"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <GroupHeader>Order summary</GroupHeader>
      <div className={GROUP_BODY}>
        <table className="w-full text-[13px] leading-tight">
          <tbody>
            {totals.items.map((item) => (
              <tr key={item.item} className={rule}>
                <td className="w-10 py-0.5 text-right tabular-nums">{item.units}</td>
                <td className="py-0.5 pl-2">{item.item}</td>
                <td className="py-0.5 text-right tabular-nums">{usd.format(item.amount)}</td>
              </tr>
            ))}
            <tr className={`${rule} font-semibold`}>
              <td className="w-10 py-0.5 text-right tabular-nums">{totals.units}</td>
              <td className="py-0.5 pl-2">Total quantity</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.merchandise)}</td>
            </tr>
            <tr className={rule}>
              <td />
              <td className="py-0.5 pl-2">Surcharges</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.surcharge)}</td>
            </tr>
            <tr className={rule}>
              <td />
              <td className="py-0.5 pl-2">Freight</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.freight)}</td>
            </tr>
            <tr>
              <td />
              <th className="py-1 pl-2 text-left text-sm font-semibold">Grand total</th>
              <td className="py-1 text-right text-sm font-semibold tabular-nums">{usd.format(totals.total)}</td>
            </tr>
            <tr className="border-t border-stone-300 text-stone-600">
              <td className="w-10 pt-1 pb-0.5 text-right tabular-nums">{totals.shipped_qty}</td>
              <td className="pt-1 pb-0.5 pl-2">Shipped</td>
              <td className="pt-1 pb-0.5 text-right tabular-nums">{usd.format(totals.shipped_value)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
