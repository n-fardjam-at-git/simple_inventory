"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComboBox } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { FitList } from "@/components/list/FitList";
import { RowButtons, SelectableRow, useList } from "@/components/list/ListTable";
import { Btn, Card } from "@/components/ui";
import { SysFolder, SysFolderOpen } from "@/components/icons/SysImages";
import {
  isOpenShipment,
  SHIPMENT_OPEN_STATUS,
  shipmentStatusLabel,
} from "@/lib/customer-shipment";
import { summarizeOrder } from "@/lib/order-summary";
import { FieldClear } from "../customer-orders/NewOrderForm";
import { WorkingBeside } from "@/components/WorkingBeside";
import { deleteShipment, saveShipmentHeader, shipShipmentOn } from "./actions";
import { shipmentSummaryLine, type ShipmentLine } from "./ShipmentProductsPanel";

export type CustomerShipmentRow = {
  id: string;
  shipment_no: number;
  created_date: string | null;
  date_shipped: string | null;
  customer_id: string;
  customer: string;
  account_no: number | null;
  account: string | null;
  status: string;
  /** Order numbers on this shipment, low to high. */
  orders: number[];
  terms: string | null;
  shipping_method: string | null;
  sales_rep: string | null;
  picker_id: string | null;
  picker: string | null;
  created_by: string | null;
  updated_by: string | null;
  tracking_no: string | null;
  /** The invoice number in Sage. */
  sage_invoice_no: string | null;
  notes: string | null;
  ship_to: string[];
  bill_to: string[];
};

export type ShipmentPicker = { id: string; label: string };

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function CustomerShipmentsTable({
  rows,
  lines,
  focusId = null,
  canWrite,
  pickers,
  onOpen,
}: {
  rows: CustomerShipmentRow[];
  lines: ShipmentLine[];
  focusId?: string | null;
  /** Admin and warehouse. A sales rep only reads. */
  canWrite: boolean;
  pickers: ShipmentPicker[];
  onOpen: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const router = useRouter();
  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    setEditing(false);
    setShipping(false);
    setDeleteErr(null);
  }, []);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function remove() {
    if (!selected || deleting) return;
    if (!confirm(`Delete shipment ${selected.shipment_no}?`)) return;
    setDeleteErr(null);
    setDeleting(true);
    try {
      const message = await deleteShipment(selected.id);
      if (message) setDeleteErr(message);
      else router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex min-h-0 w-1/2 min-w-0 flex-col">
        <FitList
          items={rows}
          getKey={(row) => row.id}
          stretch
          focusId={focusId}
          focusNonce={focusId ? 1 : 0}
          thead={
            <thead>
              <SelectionBridge onSelect={onSelect} />
              <tr className="text-stone-500">
                <th className="py-1">Shipment</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Orders</th>
                <th>Status</th>
                <th>Shipped</th>
              </tr>
            </thead>
          }
          renderRow={(row) => <ShipmentRow row={row} />}
        />
      </div>
      <ShipmentDetailsPanel
        shipment={selected}
        lines={selected ? lines.filter((line) => line.customer_shipment_id === selected.id) : []}
        canWrite={canWrite}
        deleting={deleting}
        deleteError={deleteErr}
        onDismissDeleteError={() => setDeleteErr(null)}
        onDelete={() => void remove()}
        onOpen={() => {
          if (selected) onOpen(selected.id);
        }}
        onEdit={() => {
          if (selected) setEditing(true);
        }}
        onShip={() => {
          if (selected) setShipping(true);
        }}
      />
      {editing && selected && canWrite && selected.status !== "canceled" ? (
        <ShipmentEditCard
          key={selected.id}
          shipment={selected}
          pickers={pickers}
          onClose={() => setEditing(false)}
        />
      ) : null}
      {shipping && selected && canWrite && isOpenShipment(selected.status) ? (
        <ShipCard key={selected.id} shipment={selected} onClose={() => setShipping(false)} />
      ) : null}
    </div>
  );
}

function SelectionBridge({ onSelect }: { onSelect: (id: string | null) => void }) {
  const { selectedId } = useList();
  useEffect(() => {
    onSelect(selectedId);
  }, [onSelect, selectedId]);
  return null;
}

function ShipmentRow({ row }: { row: CustomerShipmentRow }) {
  return (
    <SelectableRow id={row.id}>
      <td className="tabular-nums">
        <Link href={`/customer-shipments/${row.id}`} className="underline">
          {row.shipment_no}
        </Link>
      </td>
      <td className="tabular-nums">{row.created_date ?? "—"}</td>
      <td>{row.customer}</td>
      <td className="tabular-nums">{row.orders.length ? row.orders.join(", ") : "—"}</td>
      <td>{shipmentStatusLabel(row.status)}</td>
      <td className="tabular-nums">{row.date_shipped ?? "—"}</td>
    </SelectableRow>
  );
}

function ShipmentDetailsPanel({
  shipment,
  lines,
  canWrite,
  deleting,
  deleteError,
  onDismissDeleteError,
  onDelete,
  onOpen,
  onEdit,
  onShip,
}: {
  shipment: CustomerShipmentRow | null;
  lines: ShipmentLine[];
  canWrite: boolean;
  deleting: boolean;
  deleteError: string | null;
  onDismissDeleteError: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onShip: () => void;
}) {
  const open = isOpenShipment(shipment?.status);
  const canceled = shipment?.status === "canceled";
  const shipped = shipment?.status === "shipped";

  return (
    <div className="flex min-h-0 w-1/2 min-w-0 flex-col overflow-hidden rounded-lg border border-stone-300 bg-white p-3">
      {shipment ? (
        <>
          <div className="flex h-[39px] shrink-0 items-end justify-between gap-3 border-b border-stone-300 pb-1">
            <h2 className="min-w-0 truncate text-sm leading-5">
              <span className="font-medium text-stone-900">{shipment.customer}</span>
              <span className="font-normal text-stone-500"> · Shipment No {shipment.shipment_no}</span>
            </h2>
            <div className="flex h-[34px] shrink-0 items-center gap-2">
              <button
                type="button"
                className="group inline-flex h-full cursor-pointer rounded text-stone-600 hover:text-stone-900 [&_svg]:h-[34px] [&_svg]:w-[34px]"
                aria-label="Open shipment"
                title="Open shipment"
                onClick={onOpen}
              >
                <SysFolder className="block group-hover:hidden" />
                <SysFolderOpen className="hidden group-hover:block" />
              </button>
              {canWrite && open ? (
                <button
                  type="button"
                  className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
                  onClick={onShip}
                >
                  Ship
                </button>
              ) : null}
              {canWrite ? (
                <>
                  <span className="mx-0.5 h-6 w-px shrink-0 bg-stone-300" aria-hidden />
                  {canceled ? (
                    // A canceled shipment cannot be edited, so the chip holds Delete only.
                    <div className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
                      <span className="relative">
                        <button
                          type="button"
                          className="text-xs text-red-700 underline"
                          onClick={onDelete}
                        >
                          Delete
                        </button>
                        {deleting ? <WorkingBeside /> : null}
                      </span>
                    </div>
                  ) : (
                    <div className="[&>div]:flex-nowrap">
                      <RowButtons
                        editing={false}
                        dirty={false}
                        deleting={deleting}
                        onEdit={onEdit}
                        onSave={() => {}}
                        onCancel={() => {}}
                        onDelete={shipped ? undefined : onDelete}
                      />
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
          {deleteError ? (
            <DismissNote className="mt-3 text-xs text-red-700" onDismiss={onDismissDeleteError}>
              {deleteError}
            </DismissNote>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto pt-3 [&>*]:shrink-0">
            <Section cols={4}>
              <Fact label="Picker" value={shipment.picker || "—"} />
              <Fact label="Tracking No" value={shipment.tracking_no || "—"} />
              <Fact label="Sage invoice No" value={shipment.sage_invoice_no || "—"} />
              <Fact label="Last updated by" value={shipment.updated_by || "—"} />
            </Section>
            <Section title="Customer" cols={4}>
              <Fact
                label="Account"
                value={shipment.account_no == null ? "—" : String(shipment.account_no)}
              />
              <Fact label="Sage" value={shipment.account || "—"} />
              <Fact label="Sales rep" value={shipment.sales_rep || "—"} />
              <Fact label="Entered by" value={shipment.created_by || "—"} />
            </Section>
            <Section title="Terms and shipping" cols={2}>
              <Fact label="Terms" value={shipment.terms || "—"} />
              <Fact label="Shipping method" value={shipment.shipping_method || "—"} />
            </Section>
            <div className="grid grid-cols-2 gap-2">
              <Address title="Ship to" lines={shipment.ship_to} />
              <Address title="Bill to" lines={shipment.bill_to} />
            </div>
            <Section title="Notes" fill>
              <p className="whitespace-pre-wrap text-[13px] text-stone-900">{shipment.notes || "—"}</p>
            </Section>
          </div>
          <ShipmentSummaryGroup lines={lines} onOpen={onOpen} />
        </>
      ) : (
        <p className="m-auto text-sm text-stone-500">Select a shipment.</p>
      )}
    </div>
  );
}

const CARD_CLOSE =
  "rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100";
const CARD_CANCEL =
  "rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50";
const FIELD = "w-full rounded border py-1 pr-6 pl-2";

/** Ship is one step and is not undone, so it asks first. */
function ShipCard({ shipment, onClose }: { shipment: CustomerShipmentRow; onClose: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(todayIso);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    if (!busy) onClose();
  }

  async function ship() {
    if (busy) return;
    if (!date) {
      setErr("Enter the date shipped.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const message = await shipShipmentOn(shipment.id, date);
      if (message) {
        setErr(message);
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4"
      onClick={close}
    >
      <Card className="w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-medium">Ship shipment {shipment.shipment_no}?</p>
          <button type="button" className={CARD_CLOSE} aria-label="Close" onClick={close}>
            ×
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-stone-600">Stock comes off inventory and the shipment is locked.</p>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Date shipped</span>
            <input
              type="date"
              aria-label="Date shipped"
              className="rounded border px-2 py-1"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
          <div className="flex items-center gap-2">
            <Btn type="button" busy={busy} onClick={() => void ship()}>
              Ship
            </Btn>
            <button type="button" className={CARD_CANCEL} onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      </Card>
    </div>,
    document.body,
  );
}

/**
 * Status and picker while the shipment is open; tracking number, Sage invoice number, and notes
 * until it is canceled.
 * A shipped shipment keeps its status and picker.
 */
function ShipmentEditCard({
  shipment,
  pickers,
  onClose,
}: {
  shipment: CustomerShipmentRow;
  pickers: ShipmentPicker[];
  onClose: () => void;
}) {
  const router = useRouter();
  const open = isOpenShipment(shipment.status);
  const initial = {
    status: shipment.status,
    pickerId: shipment.picker_id ?? "",
    trackingNo: shipment.tracking_no ?? "",
    sageInvoiceNo: shipment.sage_invoice_no ?? "",
    notes: shipment.notes ?? "",
  };
  const [status, setStatus] = useState(initial.status);
  const [pickerId, setPickerId] = useState(initial.pickerId);
  const [trackingNo, setTrackingNo] = useState(initial.trackingNo);
  const [sageInvoiceNo, setSageInvoiceNo] = useState(initial.sageInvoiceNo);
  const [notes, setNotes] = useState(initial.notes);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty =
    trackingNo !== initial.trackingNo ||
    sageInvoiceNo !== initial.sageInvoiceNo ||
    notes !== initial.notes ||
    (open && (status !== initial.status || pickerId !== initial.pickerId));
  /** A picker who is no longer admin or warehouse stays on the list for this shipment. */
  const pickerOptions =
    !initial.pickerId || pickers.some((person) => person.id === initial.pickerId)
      ? pickers
      : [...pickers, { id: initial.pickerId, label: shipment.picker || "Staff" }];

  function close() {
    if (!saving) onClose();
  }

  async function save() {
    if (saving) return;
    if (open && status === "canceled" && !confirm("Cancel this shipment? It cannot be reopened.")) {
      return;
    }
    const formData = new FormData();
    formData.set("status", status);
    formData.set("picker_id", pickerId);
    formData.set("tracking_no", trackingNo);
    formData.set("sage_invoice_no", sageInvoiceNo);
    formData.set("notes", notes);
    setErr(null);
    setSaving(true);
    try {
      const message = await saveShipmentHeader(shipment.id, formData);
      if (message) {
        setErr(message);
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-transparent p-4"
      onClick={close}
    >
      <Card
        className="max-h-[90vh] w-full max-w-md overflow-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="min-w-0 font-medium">Shipment No {shipment.shipment_no}</p>
          <button type="button" className={CARD_CLOSE} aria-label="Close" onClick={close}>
            ×
          </button>
        </div>
        <div className="space-y-3 text-sm">
          {open ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs text-stone-500">Status</span>
                <select
                  aria-label="Status"
                  className="w-full rounded border px-2 py-1"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {SHIPMENT_OPEN_STATUS.map((value) => (
                    <option key={value} value={value}>
                      {shipmentStatusLabel(value)}
                    </option>
                  ))}
                  <option value="canceled">{shipmentStatusLabel("canceled")}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-stone-500">Picker</span>
                <FieldClear onClear={() => setPickerId("")}>
                  <ComboBox
                    allowEmpty
                    placeholder="Picker"
                    aria-label="Picker"
                    className={FIELD}
                    value={pickerId}
                    onChange={setPickerId}
                    options={pickerOptions}
                  />
                </FieldClear>
              </label>
            </>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Tracking No</span>
            <FieldClear onClear={() => setTrackingNo("")}>
              <input
                aria-label="Tracking No"
                className={FIELD}
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Sage invoice No</span>
            <FieldClear onClear={() => setSageInvoiceNo("")}>
              <input
                aria-label="Sage invoice No"
                className={FIELD}
                value={sageInvoiceNo}
                onChange={(e) => setSageInvoiceNo(e.target.value)}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Notes</span>
            <FieldClear top onClear={() => setNotes("")}>
              <textarea
                aria-label="Notes"
                rows={3}
                className={`${FIELD} min-h-16`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FieldClear>
          </label>
          {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
          {dirty || saving ? (
            <div className="flex items-center gap-2">
              <Btn type="button" busy={saving} onClick={() => void save()}>
                Save
              </Btn>
              <button type="button" className={CARD_CANCEL} onClick={close}>
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      </Card>
    </div>,
    document.body,
  );
}

const GROUP = "overflow-hidden rounded-md border border-stone-300 bg-stone-50";
const GROUP_BODY = "px-3 py-2";

/** Highlighted block header across the top of a group. */
function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">
      {children}
    </h3>
  );
}

const FACT_COLS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
} as const;

/** One bordered group. With `cols` the children are Facts in a compact grid. */
function Section({
  title,
  cols,
  fill = false,
  children,
}: {
  title?: string;
  cols?: keyof typeof FACT_COLS;
  /** Grow to take the free height under the other groups. */
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={fill ? `${GROUP} flex min-h-20 flex-1 flex-col !shrink` : GROUP}>
      {title ? <GroupHeader>{title}</GroupHeader> : null}
      <div className={fill ? `${GROUP_BODY} min-h-0 flex-1` : GROUP_BODY}>
        {cols ? (
          <dl className={`grid ${FACT_COLS[cols]} gap-x-3 gap-y-1.5`}>{children}</dl>
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
          lines.map((line, i) => (
            <p key={i} className="text-[13px] leading-tight text-stone-900">
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

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/**
 * Shipment summary, pinned under the scrolling details: one row per item, total quantity,
 * surcharges, freight, grand total. These are the quantities on this shipment.
 */
function ShipmentSummaryGroup({ lines, onOpen }: { lines: ShipmentLine[]; onOpen: () => void }) {
  const totals = summarizeOrder(lines.map(shipmentSummaryLine));
  const row = "border-b border-stone-200";
  return (
    <section
      className={`${GROUP} mt-2 shrink-0 cursor-pointer hover:border-stone-400`}
      title="Open the shipment products"
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
      <GroupHeader>Shipment summary</GroupHeader>
      <div className={GROUP_BODY}>
        <table className="w-full text-[13px] leading-tight">
          <tbody>
            {totals.items.map((item) => (
              <tr key={item.item} className={row}>
                <td className="w-10 py-0.5 text-right tabular-nums">{item.units}</td>
                <td className="py-0.5 pl-2">{item.item}</td>
                <td className="py-0.5 text-right tabular-nums">{usd.format(item.amount)}</td>
              </tr>
            ))}
            <tr className={`${row} font-semibold`}>
              <td className="w-10 py-0.5 text-right tabular-nums">{totals.units}</td>
              <td className="py-0.5 pl-2">Total quantity</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.merchandise)}</td>
            </tr>
            <tr className={row}>
              <td />
              <td className="py-0.5 pl-2">Surcharges</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.surcharge)}</td>
            </tr>
            <tr className={row}>
              <td />
              <td className="py-0.5 pl-2">Freight</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.freight)}</td>
            </tr>
            <tr>
              <td />
              <th className="py-1 pl-2 text-left text-sm font-semibold">Grand total</th>
              <td className="py-1 text-right text-sm font-semibold tabular-nums">
                {usd.format(totals.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
