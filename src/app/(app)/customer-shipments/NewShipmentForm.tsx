"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Btn, Card } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { customerPickLabel } from "@/lib/customer";
import { createShipmentFor } from "./actions";

export type ShipmentCustomer = {
  id: string;
  account_no: number;
  company_name: string;
  account_number: string | null;
};

/** Add new shipment, above the list. The card picks the customer. */
export function NewShipmentForm({ customers }: { customers: ShipmentCustomer[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="shrink-0">
        <Btn type="button" onClick={() => setOpen(true)}>
          Add new shipment
        </Btn>
      </div>
      {open ? <NewShipmentCard customers={customers} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function NewShipmentCard({
  customers,
  onClose,
}: {
  customers: ShipmentCustomer[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    onClose();
  }

  async function save() {
    if (saving) return;
    setErr(null);
    setSaving(true);
    try {
      const message = await createShipmentFor(customerId);
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
      <Card className="w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="min-w-0 font-medium">New shipment</p>
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
            <ComboBox
              allowEmpty
              autoFocus
              placeholder="Customer"
              aria-label="Customer"
              className="w-full rounded border py-1 pr-6 pl-2"
              value={customerId}
              onChange={(id) => {
                setCustomerId(id);
                setErr(null);
              }}
              options={customers.map((customer) => ({
                id: customer.id,
                label: customerPickLabel(customer),
              }))}
            />
          </label>
          <p className="text-xs text-stone-500">
            The first order added fills the addresses, terms, shipping method, and sales rep.
          </p>
          {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
          {customerId || saving ? (
            <div className="flex items-center gap-2">
              <Btn type="button" busy={saving} onClick={() => void save()}>
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
