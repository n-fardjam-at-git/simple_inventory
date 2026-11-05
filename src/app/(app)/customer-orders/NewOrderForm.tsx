"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Btn, Card } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { addressPickLabel, customerPickLabel } from "@/lib/customer";
import { SHIP_AT_ONCE, shipmentMethodLabel } from "@/lib/customer-order";
import { createCustomerOrder } from "./actions";

export type OrderCustomer = {
  id: string;
  account_no: number;
  company_name: string;
  account_number: string | null;
  term: string | null;
};
export type OrderAddress = {
  id: string;
  customer_id: string;
  address_type: string;
  location_name: string | null;
  city: string | null;
  address_line1: string | null;
};
export type OrderShipmentMethod = { id: string; shipper: string | null; method: string };
export type OrderTransmissionMethod = { id: string; name: string };
export type OrderSeason = { season: string };
export type OrderTerm = { term: string; days_due: number | null };

function termLabel(term: OrderTerm) {
  if (term.days_due == null) return term.term;
  const days = term.days_due === 1 ? "1 day" : `${term.days_due} days`;
  return `${term.term} · ${days}`;
}

export type OrderHeaderInitial = {
  customerId: string;
  customerLabel: string;
  shipId: string;
  billId: string;
  startDate: string;
  cancelDate: string;
  futureSeason: string;
  shipmentMethodId: string;
  shipmentLabel: string;
  transmissionMethodId: string;
  transmissionLabel: string;
  notes: string;
  terms: string;
};

const inputClass = "w-full rounded border py-1 pl-2 pr-6";

const BLANK: OrderHeaderInitial = {
  customerId: "",
  customerLabel: "",
  shipId: "",
  billId: "",
  startDate: "",
  cancelDate: "",
  futureSeason: "",
  shipmentMethodId: "",
  shipmentLabel: "",
  transmissionMethodId: "",
  transmissionLabel: "",
  notes: "",
  terms: "",
};

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function withCurrent(options: { id: string; label: string }[], id: string, label: string) {
  if (!id || options.some((option) => option.id === id)) return options;
  return [{ id, label: label || id }, ...options];
}

export function NewOrderForm({
  customers,
  addresses,
  shipmentMethods,
  transmissionMethods,
  seasons,
  terms,
}: {
  customers: OrderCustomer[];
  addresses: OrderAddress[];
  shipmentMethods: OrderShipmentMethod[];
  transmissionMethods: OrderTransmissionMethod[];
  seasons: OrderSeason[];
  terms: OrderTerm[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="shrink-0">
        <Btn type="button" onClick={() => setOpen(true)}>
          Add new order
        </Btn>
      </div>
      {open ? (
        <OrderHeaderCard
          title="New order"
          initial={BLANK}
          shipSnapshot={false}
          billSnapshot={false}
          terms={terms}
          customers={customers}
          addresses={addresses}
          shipmentMethods={shipmentMethods}
          transmissionMethods={transmissionMethods}
          seasons={seasons}
          onClose={() => setOpen(false)}
          onSave={async (formData) => {
            const message = await createCustomerOrder(formData);
            if (typeof message === "string" && message) return message;
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

export function OrderHeaderCard({
  title,
  initial,
  shipSnapshot,
  billSnapshot,
  terms: termChoices,
  customers,
  addresses,
  shipmentMethods,
  transmissionMethods,
  seasons,
  onClose,
  onSave,
}: {
  title: string;
  initial: OrderHeaderInitial;
  shipSnapshot: boolean;
  billSnapshot: boolean;
  terms: OrderTerm[];
  customers: OrderCustomer[];
  addresses: OrderAddress[];
  shipmentMethods: OrderShipmentMethod[];
  transmissionMethods: OrderTransmissionMethod[];
  seasons: OrderSeason[];
  onClose: () => void;
  onSave: (formData: FormData) => Promise<string | void>;
}) {
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [shipId, setShipId] = useState(initial.shipId);
  const [billId, setBillId] = useState(initial.billId);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [cancelDate, setCancelDate] = useState(initial.cancelDate);
  const [futureSeason, setFutureSeason] = useState(initial.futureSeason);
  const [shipmentMethodId, setShipmentMethodId] = useState(initial.shipmentMethodId);
  const [transmissionMethodId, setTransmissionMethodId] = useState(initial.transmissionMethodId);
  const [notes, setNotes] = useState(initial.notes);
  const [terms, setTerms] = useState(initial.terms);
  const [shipTouched, setShipTouched] = useState(false);
  const [billTouched, setBillTouched] = useState(false);
  const [methodTouched, setMethodTouched] = useState(false);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const mine = useMemo(
    () => addresses.filter((address) => address.customer_id === customerId),
    [addresses, customerId],
  );
  const ship = mine.filter(
    (address) => address.address_type === "shipping" || address.address_type === "both",
  );
  const bill = mine.filter(
    (address) => address.address_type === "billing" || address.address_type === "both",
  );
  const option = (address: OrderAddress) => ({
    id: address.id,
    label: addressPickLabel(address),
  });
  const customerOptions = withCurrent(
    customers.map((customer) => ({ id: customer.id, label: customerPickLabel(customer) })),
    initial.customerId,
    initial.customerLabel,
  );
  const methodOptions = withCurrent(
    shipmentMethods.map((method) => ({ id: method.id, label: shipmentMethodLabel(method) })),
    initial.shipmentMethodId,
    initial.shipmentLabel,
  );
  const termOptions = withCurrent(
    termChoices.map((term) => ({ id: term.term, label: termLabel(term) })),
    initial.terms,
    initial.terms,
  );
  const receivedOptions = withCurrent(
    transmissionMethods.map((method) => ({ id: method.id, label: method.name })),
    initial.transmissionMethodId,
    initial.transmissionLabel,
  );
  const dirty =
    customerId !== initial.customerId ||
    shipId !== initial.shipId ||
    billId !== initial.billId ||
    startDate !== initial.startDate ||
    cancelDate !== initial.cancelDate ||
    futureSeason !== initial.futureSeason ||
    shipmentMethodId !== initial.shipmentMethodId ||
    transmissionMethodId !== initial.transmissionMethodId ||
    notes !== initial.notes ||
    terms !== initial.terms;

  function close() {
    if (saving) return;
    onClose();
  }

  function pickCustomer(id: string) {
    setCustomerId(id);
    setShipId("");
    setBillId("");
    setShipTouched(true);
    setBillTouched(true);
    const customer = customers.find((row) => row.id === id);
    setTerms(customer?.term ?? (id && id === initial.customerId ? initial.terms : ""));
  }

  function persist() {
    const formData = new FormData();
    formData.set("customer_id", customerId);
    formData.set("ship_address_id", shipId);
    formData.set("bill_address_id", billId);
    formData.set("ship_keep", !shipId && !shipTouched && shipSnapshot ? "1" : "");
    formData.set("bill_keep", !billId && !billTouched && billSnapshot ? "1" : "");
    formData.set("start_date", startDate);
    formData.set("cancel_date", cancelDate);
    formData.set("future_season", futureSeason);
    formData.set("shipment_method_id", shipmentMethodId);
    formData.set("transmission_method_id", transmissionMethodId);
    formData.set(
      "method_keep",
      !shipmentMethodId && !methodTouched && initial.shipmentLabel ? "1" : "",
    );
    formData.set(
      "received_keep",
      !transmissionMethodId && !receivedTouched && initial.transmissionLabel ? "1" : "",
    );
    formData.set("notes", notes);
    formData.set("terms", terms);
    start(async () => {
      const message = await onSave(formData);
      if (typeof message === "string" && message) {
        setErr(message);
        return;
      }
      onClose();
    });
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
          <p className="min-w-0 font-medium">{title}</p>
          <button
            type="button"
            className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
            aria-label="Close"
            onClick={close}
          >
            ×
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Customer</span>
            <FieldClear onClear={() => pickCustomer("")}>
              <ComboBox
                allowEmpty
                placeholder="Customer"
                aria-label="Customer"
                className={inputClass}
                value={customerId}
                onChange={pickCustomer}
                options={customerOptions}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Bill-to</span>
            <FieldClear
              onClear={() => {
                setBillId("");
                setBillTouched(true);
              }}
            >
              <ComboBox
                key={`bill-${customerId || "none"}`}
                allowEmpty
                placeholder="Bill-to"
                aria-label="Bill-to"
                className={inputClass}
                value={billId}
                onChange={(id) => {
                  setBillId(id);
                  setBillTouched(true);
                  const address = addresses.find((row) => row.id === id);
                  if (address?.address_type === "both") {
                    setShipId(id);
                    setShipTouched(true);
                  }
                }}
                options={bill.map(option)}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Ship-to</span>
            <FieldClear
              onClear={() => {
                setShipId("");
                setShipTouched(true);
              }}
            >
              <ComboBox
                key={`ship-${customerId || "none"}`}
                allowEmpty
                placeholder="Ship-to"
                aria-label="Ship-to"
                className={inputClass}
                value={shipId}
                onChange={(id) => {
                  setShipId(id);
                  setShipTouched(true);
                }}
                options={ship.map(option)}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Terms</span>
            <FieldClear onClear={() => setTerms("")}>
              <ComboBox
                allowEmpty
                placeholder="Terms"
                aria-label="Terms"
                className={inputClass}
                value={terms}
                onChange={setTerms}
                options={termOptions}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Shipping method</span>
            <FieldClear
              onClear={() => {
                setShipmentMethodId("");
                setMethodTouched(true);
              }}
            >
              <ComboBox
                allowEmpty
                placeholder="Shipping method"
                aria-label="Shipping method"
                className={inputClass}
                value={shipmentMethodId}
                onChange={(id) => {
                  setShipmentMethodId(id);
                  setMethodTouched(true);
                }}
                options={methodOptions}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Received via</span>
            <FieldClear
              onClear={() => {
                setTransmissionMethodId("");
                setReceivedTouched(true);
              }}
            >
              <ComboBox
                allowEmpty
                placeholder="Received via"
                aria-label="Received via"
                className={inputClass}
                value={transmissionMethodId}
                onChange={(id) => {
                  setTransmissionMethodId(id);
                  setReceivedTouched(true);
                }}
                options={receivedOptions}
              />
            </FieldClear>
          </label>
          <div>
            <span className="mb-1 block text-xs text-stone-500">Season</span>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={futureSeason === SHIP_AT_ONCE}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFutureSeason(SHIP_AT_ONCE);
                    setStartDate(todayIso());
                    return;
                  }
                  setFutureSeason("");
                }}
              />
              Ship at once
            </label>
            {futureSeason === SHIP_AT_ONCE ? null : (
              <FieldClear onClear={() => setFutureSeason("")}>
                <ComboBox
                  allowEmpty
                  placeholder="Season"
                  aria-label="Season"
                  className={`${inputClass} mt-2`}
                  value={futureSeason}
                  onChange={setFutureSeason}
                  options={seasons.map((season) => ({
                    id: season.season,
                    label: season.season,
                  }))}
                />
              </FieldClear>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">Start</span>
              <FieldClear onClear={() => setStartDate("")} className="right-8">
                <input
                  type="date"
                  aria-label="Start"
                  className="w-full rounded border py-1 pl-2 pr-14"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </FieldClear>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">Cancel</span>
              <FieldClear onClear={() => setCancelDate("")} className="right-8">
                <input
                  type="date"
                  aria-label="Cancel"
                  title="Latest date the order can be delivered"
                  className="w-full rounded border py-1 pl-2 pr-14"
                  value={cancelDate}
                  onChange={(e) => setCancelDate(e.target.value)}
                />
              </FieldClear>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Notes</span>
            <FieldClear top onClear={() => setNotes("")}>
              <textarea
                aria-label="Notes"
                rows={3}
                className={`${inputClass} min-h-16`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FieldClear>
          </label>
          {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
          {dirty || saving ? (
            <div className="flex items-center gap-2">
              <Btn type="button" busy={saving} onClick={persist}>
                Save
              </Btn>
              <button
                type="button"
                className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
                onClick={close}
              >
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

function FieldClear({
  onClear,
  top = false,
  className = "right-1",
  children,
}: {
  onClear: () => void;
  top?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative" data-clear-wrap="">
      {children}
      <button
        type="button"
        data-clear-btn=""
        className={`absolute z-10 px-0.5 text-sm leading-none text-stone-400 hover:text-stone-700 ${
          top ? "top-1.5" : "top-1/2 -translate-y-1/2"
        } ${className}`}
        aria-label="Clear"
        onClick={onClear}
      >
        ×
      </button>
    </div>
  );
}