"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ComboBox } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { Busy } from "@/components/WorkingBeside";
import { deliverByMessage, SHIP_AT_ONCE } from "@/lib/customer-order";
import type { SeasonRow } from "@/lib/season";
import type { RequestAddress } from "../my-orders/types";
import type { RequestHeaderInput } from "../my-orders/actions";

function addressLabel(address: RequestAddress) {
  const place = [address.city, address.address_line1].filter(Boolean).join(", ");
  return [address.location_name, place].filter(Boolean).join(" • ") || "Address";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PostOrderPopup({
  seasons,
  addresses,
  posting,
  onPost,
  onClose,
}: {
  seasons: SeasonRow[];
  addresses: RequestAddress[];
  posting: boolean;
  onPost: (header: RequestHeaderInput) => Promise<string | null>;
  onClose: () => void;
}) {
  const shipChoices = addresses.filter(
    (address) => address.address_type === "shipping" || address.address_type === "both",
  );
  const billChoices = addresses.filter(
    (address) => address.address_type === "billing" || address.address_type === "both",
  );
  const firstBill = billChoices[0]?.id ?? "";
  const billIsBoth = addresses.find((address) => address.id === firstBill)?.address_type === "both";
  const [season, setSeason] = useState(SHIP_AT_ONCE);
  const [start, setStart] = useState(today());
  const [cancel, setCancel] = useState("");
  const [notes, setNotes] = useState("");
  const [shipId, setShipId] = useState(billIsBoth ? firstBill : (shipChoices[0]?.id ?? ""));
  const [billId, setBillId] = useState(firstBill);
  const [err, setErr] = useState<string | null>(null);

  async function post() {
    if (posting) return;
    const deliverBy = deliverByMessage(start, cancel);
    if (deliverBy) {
      setErr(deliverBy);
      return;
    }
    const message = await onPost({
      future_season: season.trim() || null,
      start_date: start.trim() || null,
      cancel_date: cancel.trim() || null,
      notes: notes.trim() || null,
      ship_address_id: shipId || null,
      bill_address_id: billId || null,
    });
    if (message) setErr(message);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-transparent p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => !posting && onClose()} />
      <div className="relative z-10 max-h-[80vh] w-[min(36rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-stone-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Order details</h2>
          <button
            type="button"
            className="text-lg leading-none text-stone-500"
            aria-label="Close"
            onClick={() => !posting && onClose()}
          >
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
                if (!start) setStart(today());
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
            <input
              type="date"
              className="w-full rounded border px-2 py-1"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Deliver by</span>
            <input
              type="date"
              required
              aria-label="Deliver by"
              className="w-full rounded border px-2 py-1"
              value={cancel}
              onChange={(event) => setCancel(event.target.value)}
            />
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
              onChange={setShipId}
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
                if (addresses.find((address) => address.id === id)?.address_type === "both" && !shipId) {
                  setShipId(id);
                }
              }}
              options={billChoices.map((address) => ({ id: address.id, label: addressLabel(address) }))}
            />
          </label>
        </div>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs text-stone-500">Notes</span>
          <textarea
            className="w-full rounded border px-2 py-1"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="flex items-center gap-2">
          <Busy on={posting} side="right">
            <button
              type="button"
              disabled={posting}
              onClick={() => void post()}
              className="relative h-11 overflow-hidden rounded-lg border border-[#FDE68A]/60 bg-[linear-gradient(135deg,#F59E0B,#D97706)] px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(217,119,6,0.28)] disabled:opacity-40"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
              <span className="relative">Post</span>
            </button>
          </Busy>
          <button
            type="button"
            className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
            disabled={posting}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
