"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FitPage } from "@/components/list/FitList";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, RowButtons, useList } from "@/components/list/ListTable";
import { PageTitle, Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { DismissNote } from "@/components/DismissNote";
import { SysFolder, SysFolderOpen } from "@/components/icons/SysImages";
import { deliverByMessage, LINE_PRICE_NOTICE, SHIP_AT_ONCE, staffReplyText } from "@/lib/customer-order";
import { summarizeOrder } from "@/lib/order-summary";
import { PRODUCT_TYPE } from "@/lib/product-type";
import type { SeasonRow } from "@/lib/season";
import { deleteRequest, saveRequestHeader, submitRequest } from "./actions";
import { RequestProductsPanel } from "./RequestProductsPanel";
import type { RequestAddress, RequestCatalogChoice, RequestLine, RequestOrder, RequestSetItem } from "./types";

function statusLabel(status: string) {
  if (status === "submitted") return "Submitted";
  if (status === "accepted") return "Accepted";
  return "Draft";
}

function acceptanceLabel(value: boolean | null) {
  if (value === true) return "Accepted prices and terms";
  if (value === false) return "Waiting for review";
  return "—";
}

type Filters = { orderNo: string; season: string; status: string };

const EMPTY_FILTER: Filters = { orderNo: "", season: "", status: "" };
const filterField = "w-full rounded border py-1 pr-6 pl-2";
const STATUS_OPTIONS = [
  { id: "draft", label: "Draft" },
  { id: "submitted", label: "Submitted" },
  { id: "accepted", label: "Accepted" },
];

function filtersActive(filters: Filters) {
  return Boolean(filters.orderNo.trim() || filters.season || filters.status);
}

function addressLabel(address: RequestAddress) {
  const place = [address.city, address.address_line1].filter(Boolean).join(", ");
  return [address.location_name, place].filter(Boolean).join(" • ") || "Address";
}

export function MyOrdersWorkspace({
  orders,
  lines,
  setItems,
  catalog,
  seasons,
  addresses,
  resumeId,
}: {
  orders: RequestOrder[];
  lines: RequestLine[];
  setItems: RequestSetItem[];
  catalog: RequestCatalogChoice[];
  seasons: SeasonRow[];
  addresses: RequestAddress[];
  resumeId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(resumeId);
  const [panelId, setPanelId] = useState<string | null>(resumeId);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTER);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTER);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const orderNoEntered = Boolean(draft.orderNo.trim());
  const filtered = useMemo(() => {
    const orderNo = applied.orderNo.trim().toLocaleLowerCase("en");
    return orders.filter((order) => {
      if (orderNo && !String(order.request_no).toLocaleLowerCase("en").includes(orderNo)) return false;
      if (applied.season && order.future_season !== applied.season) return false;
      if (applied.status && order.status !== applied.status) return false;
      return true;
    });
  }, [orders, applied]);
  const selected = filtered.find((order) => order.id === selectedId) ?? null;
  const seasonOptions = useMemo(() => {
    const names = new Set<string>([SHIP_AT_ONCE]);
    for (const season of seasons) names.add(season.season);
    for (const order of orders) if (order.future_season) names.add(order.future_season);
    return [...names].map((name) => ({ id: name, label: name }));
  }, [seasons, orders]);

  function resetFilter() {
    setDraft(EMPTY_FILTER);
    setApplied(EMPTY_FILTER);
    setComboKey((key) => key + 1);
  }

  function findByOrderNo() {
    const text = draft.orderNo.trim().toLocaleLowerCase("en");
    if (!text) return;
    const order = filtered.find((item) => String(item.request_no).toLocaleLowerCase("en") === text);
    if (!order) return;
    setFocusId(order.id);
    setFocusNonce((nonce) => nonce + 1);
    setFilterOpen(false);
  }

  return (
    <>
      <FitPage>
        <PageTitle
          title="My orders"
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
          <div className="flex w-1/2 min-w-0">
            <FitList
              items={filtered}
              getKey={(order) => order.id}
              resumeId={resumeId}
              focusId={focusId}
              focusNonce={focusNonce}
              stretch
              thead={
                <thead>
                  <Bridge onSelect={setSelectedId} />
                  <tr className="text-stone-500">
                    <th className="py-1">Order</th>
                    <th className="py-1">Date</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
              }
              renderRow={(order) => (
                <SelectableRow id={order.id}>
                  <td className="py-1.5 font-medium">Order {order.request_no}</td>
                  <td className="tabular-nums">{order.created_at}</td>
                  <td>{statusLabel(order.status)}</td>
                </SelectableRow>
              )}
            />
          </div>
          <OrderDetails
            order={selected}
            lines={lines.filter((line) => line.request_id === selectedId)}
            seasons={seasons}
            addresses={addresses}
            panelOpen={panelId === selected?.id}
            onOpenProducts={() => selected && setPanelId(selected.id)}
            onSelect={setSelectedId}
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
          <span className="mb-1 block text-stone-500">Order</span>
          <FilterClear
            goVisible={orderNoEntered}
            onGo={findByOrderNo}
            onClear={() => setDraft((current) => ({ ...current, orderNo: "" }))}
          >
            <input
              aria-label="Order"
              className={`w-full rounded border py-1 pl-2 ${orderNoEntered ? "pr-10" : "pr-6"}`}
              value={draft.orderNo}
              onChange={(event) => setDraft((current) => ({ ...current, orderNo: event.target.value }))}
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
              className={filterField}
              value={draft.season}
              onChange={(id) => setDraft((current) => ({ ...current, season: id }))}
              options={seasonOptions}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Status</span>
          <FilterClear onClear={() => setDraft((current) => ({ ...current, status: "" }))}>
            <ComboBox
              allowEmpty
              placeholder="Status"
              aria-label="Status"
              className={filterField}
              value={draft.status}
              onChange={(id) => setDraft((current) => ({ ...current, status: id }))}
              options={STATUS_OPTIONS}
            />
          </FilterClear>
        </label>
      </DockedFilterPanel>
      <RequestProductsPanel
        open={panelId != null && panelId === selected?.id}
        onClose={() => setPanelId(null)}
        requestId={selected?.id ?? null}
        requestNo={selected?.request_no ?? null}
        lines={lines.filter((line) => line.request_id === selectedId)}
        draft={selected?.status === "draft"}
        setItems={setItems}
        catalog={catalog}
      />
    </>
  );
}

function OrderDetails({
  order,
  lines,
  seasons,
  addresses,
  panelOpen,
  onOpenProducts,
  onSelect,
}: {
  order: RequestOrder | null;
  lines: RequestLine[];
  seasons: SeasonRow[];
  addresses: RequestAddress[];
  panelOpen: boolean;
  onOpenProducts: () => void;
  onSelect: (id: string | null) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [askSend, setAskSend] = useState(false);
  const [acceptance, setAcceptance] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const draft = order?.status === "draft";

  useEffect(() => {
    setEditing(false);
    setAskSend(false);
    setAcceptance(true);
    setErr(null);
  }, [order?.id]);

  function confirmSend() {
    if (!order || sending) return;
    setSending(true);
    void (async () => {
      try {
        const message = await submitRequest(order.id, acceptance);
        if (message) setErr(message);
        else {
          setAskSend(false);
          router.refresh();
        }
      } finally {
        setSending(false);
      }
    })();
  }

  return (
    <div className="flex min-h-0 w-1/2 min-w-0 flex-col rounded-lg border border-stone-300 bg-white p-3">
      {order ? (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2">
            <h2 className="min-w-0 truncate text-sm">
              <span className="font-medium">Order {order.request_no}</span>
              <span className="ml-2 font-light text-stone-500">{statusLabel(order.status)}</span>
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="relative inline-flex h-7 w-7 shrink-0 cursor-pointer"
                aria-label="Products"
                title="Products"
                onClick={onOpenProducts}
              >
                <span className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 [&_svg]:h-[46px] [&_svg]:w-[46px]">
                  {panelOpen ? <SysFolderOpen /> : <SysFolder />}
                </span>
              </button>
              {draft ? (
                <Btn
                  type="button"
                  onClick={() => {
                    if (askSend || sending) return;
                    setAcceptance(true);
                    setErr(null);
                    setAskSend(true);
                  }}
                >
                  Send
                </Btn>
              ) : null}
              {draft ? (
                <RowButtons
                  editing={false}
                  dirty={false}
                  deleting={deleting}
                  onEdit={() => setEditing(true)}
                  onSave={() => {}}
                  onCancel={() => {}}
                  onDelete={() => {
                    if (!confirm(`Delete order ${order.request_no}?`)) return;
                    startDelete(async () => {
                      const message = await deleteRequest(order.id);
                      if (message) setErr(message);
                      else {
                        onSelect(null);
                        router.refresh();
                      }
                    });
                  }}
                />
              ) : null}
            </div>
          </div>
          {err && !askSend ? (
            <DismissNote className="mt-3 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <div className="min-h-0 flex-1 space-y-2 overflow-auto pt-3">
            <Section>
              <Fact label="Season" value={order.future_season || "—"} />
              <Fact label="Start" value={order.start_date || "—"} />
              <Fact label="Deliver by" value={order.cancel_date || "—"} />
            </Section>
            <Section title="Terms and shipping">
              <Fact label="Terms" value={order.terms || "—"} />
              <Fact label="Shipping method" value={order.shipping_method || "—"} />
            </Section>
            <div className="grid grid-cols-2 gap-2">
              <Address title="Ship to" lines={order.ship} />
              <Address title="Bill to" lines={order.bill} />
            </div>
            <Section title="Prices and terms">
              <p className="text-[13px]">{acceptanceLabel(order.customer_acceptance)}</p>
            </Section>
            <Section title="Staff reply">
              <p
                className={`whitespace-pre-wrap text-sm leading-tight ${
                  staffReplyText(order.staff_reply).trim() === LINE_PRICE_NOTICE ? "font-light text-red-700" : ""
                }`}
              >
                {staffReplyText(order.staff_reply)}
              </p>
            </Section>
            <Section title="Notes">
              <p className="whitespace-pre-wrap text-[13px]">{order.notes || "—"}</p>
            </Section>
          </div>
          <OrderSummary lines={lines} onOpen={onOpenProducts} />
          {editing ? (
            <EditCard
              order={order}
              seasons={seasons}
              addresses={addresses}
              onClose={() => setEditing(false)}
            />
          ) : null}
          {askSend ? (
            <SendCard
              requestNo={order.request_no}
              acceptance={acceptance}
              sending={sending}
              err={err}
              onAcceptance={setAcceptance}
              onDismiss={() => setErr(null)}
              onCancel={() => {
                if (sending) return;
                setAskSend(false);
                setErr(null);
              }}
              onSend={confirmSend}
            />
          ) : null}
        </>
      ) : (
        <p className="m-auto text-sm text-stone-500">Select an order.</p>
      )}
    </div>
  );
}

function Bridge({ onSelect }: { onSelect: (id: string | null) => void }) {
  const { selectedId } = useList();
  useEffect(() => {
    onSelect(selectedId);
  }, [onSelect, selectedId]);
  return null;
}

function SendCard({
  requestNo,
  acceptance,
  sending,
  err,
  onAcceptance,
  onDismiss,
  onCancel,
  onSend,
}: {
  requestNo: number;
  acceptance: boolean;
  sending: boolean;
  err: string | null;
  onAcceptance: (value: boolean) => void;
  onDismiss: () => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onCancel} />
      <div className="relative z-10 w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Send order {requestNo}</h2>
          <button type="button" className="text-lg leading-none text-stone-500" aria-label="Close" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="mb-4 space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              className="mt-1"
              name="customer-acceptance"
              checked={acceptance}
              onChange={() => onAcceptance(true)}
            />
            <span>Accept all prices and terms (the order can be processed and shipped)</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              className="mt-1"
              name="customer-acceptance"
              checked={!acceptance}
              onChange={() => onAcceptance(false)}
            />
            <span>Wait for order review (the order will not be processed)</span>
          </label>
        </div>
        {err ? (
          <DismissNote className="mb-3 text-xs text-red-700" onDismiss={onDismiss}>
            {err}
          </DismissNote>
        ) : null}
        <div className="flex gap-2">
          <Btn type="button" busy={sending} onClick={onSend}>
            Send
          </Btn>
          <button
            type="button"
            className="rounded border border-stone-300 px-3 py-1.5 text-sm"
            disabled={sending}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EditCard({
  order,
  seasons,
  addresses,
  onClose,
}: {
  order: RequestOrder;
  seasons: SeasonRow[];
  addresses: RequestAddress[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [season, setSeason] = useState(order.future_season ?? "");
  const [start, setStart] = useState(order.start_date ?? "");
  const [cancel, setCancel] = useState(order.cancel_date ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [shipId, setShipId] = useState("");
  const [billId, setBillId] = useState("");
  const [shipSet, setShipSet] = useState(false);
  const [billSet, setBillSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty =
    season !== (order.future_season ?? "") ||
    start !== (order.start_date ?? "") ||
    cancel !== (order.cancel_date ?? "") ||
    notes !== (order.notes ?? "") ||
    shipSet ||
    billSet;
  const shipChoices = addresses.filter(
    (address) => address.address_type === "shipping" || address.address_type === "both",
  );
  const billChoices = addresses.filter(
    (address) => address.address_type === "billing" || address.address_type === "both",
  );

  function save() {
    if (saving) return;
    const deliverBy = deliverByMessage(start, cancel);
    if (deliverBy) {
      setErr(deliverBy);
      return;
    }
    const form = new FormData();
    form.set("future_season", season);
    form.set("start_date", start);
    form.set("cancel_date", cancel);
    form.set("notes", notes);
    if (shipSet) {
      form.set("ship_set", "1");
      form.set("ship_address_id", shipId);
    }
    if (billSet) {
      form.set("bill_set", "1");
      form.set("bill_address_id", billId);
    }
    setSaving(true);
    void (async () => {
      try {
        const message = await saveRequestHeader(order.id, form);
        if (message) {
          setErr(message);
          return;
        }
        onClose();
        router.refresh();
      } finally {
        setSaving(false);
      }
    })();
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => !saving && onClose()} />
      <div className="relative z-10 w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Order {order.request_no}</h2>
          <button type="button" className="text-lg leading-none text-stone-500" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {err ? (
          <DismissNote className="mb-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
            {err}
          </DismissNote>
        ) : null}
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={season === SHIP_AT_ONCE}
            onChange={(event) => {
              if (event.target.checked) {
                setSeason(SHIP_AT_ONCE);
                if (!start) setStart(new Date().toISOString().slice(0, 10));
              } else {
                setSeason("");
              }
            }}
          />
          Ship at once
        </label>
        {season === SHIP_AT_ONCE ? null : (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Season</span>
            <ComboBox
              allowEmpty
              placeholder="Season"
              className="w-full rounded border py-1 pr-6 pl-2"
              value={season}
              onChange={setSeason}
              options={seasons.map((item) => ({ id: item.season, label: item.season }))}
            />
          </label>
        )}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Start</span>
            <input type="date" className="w-full rounded border px-2 py-1" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Deliver by</span>
            <input type="date" required aria-label="Deliver by" className="w-full rounded border px-2 py-1" value={cancel} onChange={(event) => setCancel(event.target.value)} />
          </label>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Ship to</span>
            <ComboBox
              allowEmpty
              placeholder="Ship to"
              className="w-full rounded border py-1 pr-6 pl-2"
              value={shipId}
              onChange={(id) => {
                setShipId(id);
                setShipSet(true);
              }}
              options={shipChoices.map((address) => ({ id: address.id, label: addressLabel(address) }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Bill to</span>
            <ComboBox
              allowEmpty
              placeholder="Bill to"
              className="w-full rounded border py-1 pr-6 pl-2"
              value={billId}
              onChange={(id) => {
                setBillId(id);
                setBillSet(true);
                if (addresses.find((address) => address.id === id)?.address_type === "both" && !shipSet) {
                  setShipId(id);
                  setShipSet(true);
                }
              }}
              options={billChoices.map((address) => ({ id: address.id, label: addressLabel(address) }))}
            />
          </label>
        </div>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs text-stone-500">Notes</span>
          <textarea className="w-full rounded border px-2 py-1" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {dirty ? (
          <div className="flex gap-2">
            <Btn type="button" busy={saving} onClick={save}>
              Save
            </Btn>
            <button type="button" className="rounded border border-stone-300 px-3 py-1.5 text-sm" onClick={onClose}>
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

const GROUP = "overflow-hidden rounded-md border border-stone-300 bg-stone-50";
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function OrderSummary({ lines, onOpen }: { lines: RequestLine[]; onOpen: () => void }) {
  const totals = summarizeOrder(
    lines.map((line) => {
      const merchandise = line.type === PRODUCT_TYPE.merchandise;
      const ordered = merchandise
        ? line.cells.reduce((sum, cell) => sum + (Number(cell.qty) || 0), 0)
        : line.type === PRODUCT_TYPE.freight
          ? 1
          : Number(line.qty) || 0;
      const price = Number(line.price) || 0;
      const extended = merchandise
        ? line.cells.reduce((sum, cell) => sum + (Number(cell.qty) || 0) * (price + (Number(cell.upcharge) || 0)), 0)
        : ordered * price;
      return {
        type: line.type,
        status: "pending",
        item: line.item,
        ordered,
        extended,
        shipped: 0,
        shipped_value: 0,
      };
    }),
  );
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
      <h3 className="border-b border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">
        Order summary
      </h3>
      <div className="px-3 py-2">
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
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={GROUP}>
      {title ? (
        <h3 className="border-b border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">
          {title}
        </h3>
      ) : null}
      <div className={`grid grid-cols-3 gap-x-3 gap-y-1.5 px-3 py-2 ${title ? "" : ""}`}>{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-stone-500">{label}</dt>
      <dd className="text-[13px]">{value}</dd>
    </div>
  );
}

function Address({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className={GROUP}>
      <h3 className="border-b border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">
        {title}
      </h3>
      <div className="px-3 py-2 text-[13px]">
        {lines.length ? lines.map((line) => <p key={line}>{line}</p>) : <p>—</p>}
      </div>
    </section>
  );
}
