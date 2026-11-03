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

type Customer = { id: string; account_no: number; company_name: string; account_number: string | null };
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
type Season = { season: string };

const inputClass = "w-full rounded border py-1 pl-2 pr-6";

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function NewOrderForm({
  customers,
  addresses,
  shipmentMethods,
  transmissionMethods,
  seasons,
}: {
  customers: Customer[];
  addresses: Address[];
  shipmentMethods: ShipmentMethod[];
  transmissionMethods: TransmissionMethod[];
  seasons: Season[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [shipId, setShipId] = useState("");
  const [billId, setBillId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [cancelDate, setCancelDate] = useState("");
  const [futureSeason, setFutureSeason] = useState("");
  const [shipmentMethodId, setShipmentMethodId] = useState("");
  const [transmissionMethodId, setTransmissionMethodId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const mine = useMemo(
    () => addresses.filter((address) => address.customer_id === customerId),
    [addresses, customerId],
  );
  const ship = mine.filter((address) => address.address_type === "shipping" || address.address_type === "both");
  const bill = mine.filter((address) => address.address_type === "billing" || address.address_type === "both");
  const option = (address: Address) => ({
    id: address.id,
    label: addressPickLabel(address),
  });
  const dirty = Boolean(
    customerId ||
      shipId ||
      billId ||
      startDate ||
      cancelDate ||
      futureSeason ||
      shipmentMethodId ||
      transmissionMethodId,
  );

  function reset() {
    setCustomerId("");
    setShipId("");
    setBillId("");
    setStartDate("");
    setCancelDate("");
    setFutureSeason("");
    setShipmentMethodId("");
    setTransmissionMethodId("");
    setErr(null);
  }

  function close() {
    if (saving) return;
    reset();
    setOpen(false);
  }

  function pickCustomer(id: string) {
    setCustomerId(id);
    setShipId("");
    setBillId("");
  }

  function pickBill(id: string) {
    setBillId(id);
    const address = addresses.find((row) => row.id === id);
    if (address?.address_type === "both") setShipId(id);
  }

  function persist() {
    const formData = new FormData();
    formData.set("customer_id", customerId);
    formData.set("ship_address_id", shipId);
    formData.set("bill_address_id", billId);
    formData.set("start_date", startDate);
    formData.set("cancel_date", cancelDate);
    formData.set("future_season", futureSeason);
    formData.set("shipment_method_id", shipmentMethodId);
    formData.set("transmission_method_id", transmissionMethodId);
    start(async () => {
      const message = await createCustomerOrder(formData);
      if (typeof message === "string" && message) {
        setErr(message);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="shrink-0">
        <Btn type="button" onClick={() => setOpen(true)}>
          Add new order
        </Btn>
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-transparent p-4"
              onClick={close}
            >
              <Card
                className="max-h-[90vh] w-full max-w-md overflow-auto shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="min-w-0 font-medium">New order</p>
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
                        options={customers.map((customer) => ({
                          id: customer.id,
                          label: customerPickLabel(customer),
                        }))}
                      />
                    </FieldClear>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-stone-500">Bill-to</span>
                    <FieldClear onClear={() => pickBill("")}>
                      <ComboBox
                        key={`bill-${customerId || "none"}`}
                        allowEmpty
                        placeholder="Bill-to"
                        aria-label="Bill-to"
                        className={inputClass}
                        value={billId}
                        onChange={pickBill}
                        options={bill.map(option)}
                      />
                    </FieldClear>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-stone-500">Ship-to</span>
                    <FieldClear onClear={() => setShipId("")}>
                      <ComboBox
                        key={`ship-${customerId || "none"}`}
                        allowEmpty
                        placeholder="Ship-to"
                        aria-label="Ship-to"
                        className={inputClass}
                        value={shipId}
                        onChange={setShipId}
                        options={ship.map(option)}
                      />
                    </FieldClear>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-stone-500">Shipping method</span>
                    <FieldClear onClear={() => setShipmentMethodId("")}>
                      <ComboBox
                        allowEmpty
                        placeholder="Shipping method"
                        aria-label="Shipping method"
                        className={inputClass}
                        value={shipmentMethodId}
                        onChange={setShipmentMethodId}
                        options={shipmentMethods.map((method) => ({
                          id: method.id,
                          label: shipmentMethodLabel(method),
                        }))}
                      />
                    </FieldClear>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-stone-500">Received via</span>
                    <FieldClear onClear={() => setTransmissionMethodId("")}>
                      <ComboBox
                        allowEmpty
                        placeholder="Received via"
                        aria-label="Received via"
                        className={inputClass}
                        value={transmissionMethodId}
                        onChange={setTransmissionMethodId}
                        options={transmissionMethods.map((method) => ({
                          id: method.id,
                          label: method.name,
                        }))}
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
          )
        : null}
    </>
  );
}

function FieldClear({
  onClear,
  className = "right-1",
  children,
}: {
  onClear: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative" data-clear-wrap="">
      {children}
      <button
        type="button"
        data-clear-btn=""
        className={`absolute top-1/2 z-10 -translate-y-1/2 px-0.5 text-sm leading-none text-stone-400 hover:text-stone-700 ${className}`}
        aria-label="Clear"
        onClick={onClear}
      >
        ×
      </button>
    </div>
  );
}
