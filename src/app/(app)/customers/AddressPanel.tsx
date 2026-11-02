"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Btn, Card } from "@/components/ui";
import { DismissNote } from "@/components/DismissNote";
import { DockedPanel } from "@/components/filter/DockedPanel";
import { WorkingBeside } from "@/components/WorkingBeside";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, useList } from "@/components/list/ListTable";
import { regionChoices } from "@/lib/regions";
import { toSentenceCase } from "@/lib/text-case";
import { createAddress, deleteAddress, updateAddress, type AddressPatch } from "./actions";
import type { CustomerAddress } from "./CustomerDetailsPanel";
import type { CustomerRow } from "./CustomersTable";

const blankAddress: AddressPatch = {
  addressType: "shipping",
  locationName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "USA",
};

const fieldClass = "w-full rounded border px-2 py-1";

function patchFromAddress(address: CustomerAddress): AddressPatch {
  return {
    addressType: address.address_type,
    locationName: address.location_name ?? "",
    addressLine1: address.address_line1 ?? "",
    addressLine2: address.address_line2 ?? "",
    city: address.city ?? "",
    region: address.region ?? "",
    postalCode: address.postal_code ?? "",
    country: address.country ?? "",
  };
}

type AddressCardState =
  | { mode: "add" }
  | { mode: "edit"; address: CustomerAddress }
  | { mode: "view"; address: CustomerAddress };

export function AddressPanel({
  open,
  customer,
  addresses,
  canEdit,
  focusId = null,
  focusNonce = 0,
  onClose,
  beforeSwitch,
}: {
  open: boolean;
  customer: CustomerRow | null;
  addresses: CustomerAddress[];
  canEdit: boolean;
  focusId?: string | null;
  focusNonce?: number;
  onClose: () => void;
  beforeSwitch: { current: (after: () => void) => void };
}) {
  const leaveRef = useRef<() => void>(() => onClose());
  leaveRef.current = () => onClose();
  beforeSwitch.current = (after) => after();

  return (
    <DockedPanel
      open={open && customer != null}
      onClose={() => leaveRef.current()}
      title="Addresses"
      subtitle={customer?.company_name}
      side="right"
      width="52rem"
    >
      {customer ? (
        <AddressWorkspace
          customerId={customer.id}
          companyName={customer.company_name}
          addresses={addresses}
          canEdit={canEdit}
          focusId={focusId}
          focusNonce={focusNonce}
          onClose={onClose}
          leaveRef={leaveRef}
          beforeSwitch={beforeSwitch}
        />
      ) : null}
    </DockedPanel>
  );
}

function AddressWorkspace({
  customerId,
  companyName,
  addresses,
  canEdit,
  focusId,
  focusNonce,
  onClose,
  leaveRef,
  beforeSwitch,
}: {
  customerId: string;
  companyName: string;
  addresses: CustomerAddress[];
  canEdit: boolean;
  focusId: string | null;
  focusNonce: number;
  onClose: () => void;
  leaveRef: { current: () => void };
  beforeSwitch: { current: (after: () => void) => void };
}) {
  const [card, setCard] = useState<AddressCardState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cardOpen = useRef(false);
  cardOpen.current = card != null;

  function freshAddress(): AddressPatch {
    return { ...blankAddress, locationName: toSentenceCase(companyName.trim()) };
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {err ? (
        <DismissNote className="shrink-0 text-xs text-red-700" onDismiss={() => setErr(null)}>
          {err}
        </DismissNote>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <FitList
          items={addresses}
          getKey={(address) => address.id}
          stretch
          focusId={focusId}
          focusNonce={focusNonce}
          thead={
            <thead>
              <LeaveBridge
                leaveRef={leaveRef}
                onClose={onClose}
                beforeSwitch={beforeSwitch}
                cardOpen={cardOpen}
                closeCard={() => setCard(null)}
              />
              <tr className="text-stone-500">
                <th className="py-1">Location name</th>
                <th>Type</th>
                <th>
                  <span className="flex items-center justify-between gap-2">
                    <span>Address</span>
                    <AddressActions
                      addresses={addresses}
                      customerId={customerId}
                      canEdit={canEdit}
                      deleting={deleting}
                      setDeleting={setDeleting}
                      setErr={setErr}
                      onAdd={() => setCard({ mode: "add" })}
                      onEdit={(address) => setCard({ mode: "edit", address })}
                      onView={(address) => setCard({ mode: "view", address })}
                    />
                  </span>
                </th>
              </tr>
            </thead>
          }
          renderRow={(address) => <AddressRow address={address} />}
        />
      </div>
      {card ? (
        <AddressCard
          title={card.mode === "add" ? "New address" : card.address.location_name || "Address"}
          initial={card.mode === "add" ? freshAddress() : patchFromAddress(card.address)}
          readOnly={card.mode === "view"}
          onCancel={() => setCard(null)}
          onSubmit={async (patch) => {
            if (card.mode === "view") return null;
            const message =
              card.mode === "add"
                ? await createAddress(customerId, patch)
                : await updateAddress(card.address.id, customerId, patch);
            if (message) return message;
            setCard(null);
            return null;
          }}
        />
      ) : null}
    </div>
  );
}

function LeaveBridge({
  leaveRef,
  onClose,
  beforeSwitch,
  cardOpen,
  closeCard,
}: {
  leaveRef: { current: () => void };
  onClose: () => void;
  beforeSwitch: { current: (after: () => void) => void };
  cardOpen: { current: boolean };
  closeCard: () => void;
}) {
  const list = useList();
  leaveRef.current = () => {
    if (cardOpen.current) {
      closeCard();
      return;
    }
    list.tryLeave(onClose);
  };
  beforeSwitch.current = (after) => list.tryLeave(after);
  return null;
}

function AddressActions({
  addresses,
  customerId,
  canEdit,
  deleting,
  setDeleting,
  setErr,
  onAdd,
  onEdit,
  onView,
}: {
  addresses: CustomerAddress[];
  customerId: string;
  canEdit: boolean;
  deleting: boolean;
  setDeleting: (deleting: boolean) => void;
  setErr: (err: string | null) => void;
  onAdd: () => void;
  onEdit: (address: CustomerAddress) => void;
  onView: (address: CustomerAddress) => void;
}) {
  const router = useRouter();
  const list = useList();
  const [, start] = useTransition();
  const selected = addresses.find((address) => address.id === list.selectedId) ?? null;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="text-xs text-stone-700 disabled:cursor-default disabled:text-stone-300"
        disabled={!selected}
        onClick={() => {
          if (selected) onView(selected);
        }}
      >
        .....
      </button>
      {canEdit ? (
        <button type="button" className="text-xs text-stone-700 underline" onClick={onAdd}>
          Add
        </button>
      ) : null}
      {canEdit ? (
      <button
        type="button"
        className="text-xs text-stone-700 underline disabled:cursor-default disabled:text-stone-300 disabled:no-underline"
        disabled={!selected || deleting}
        onClick={() => {
          if (selected) onEdit(selected);
        }}
      >
        Edit
      </button>
      ) : null}
      {canEdit ? (
      <span className="relative">
        <button
          type="button"
          className="text-xs text-red-700 underline disabled:cursor-default disabled:text-stone-300 disabled:no-underline"
          disabled={!selected || deleting}
          onClick={() => {
            if (!selected || deleting) return;
            if (!confirm(`Delete ${selected.location_name || "this address"}?`)) return;
            const id = selected.id;
            setDeleting(true);
            start(async () => {
              try {
                const message = await deleteAddress(id, customerId);
                if (message) setErr(message);
                else {
                  setErr(null);
                  router.refresh();
                }
              } finally {
                setDeleting(false);
              }
            });
          }}
        >
          Delete
        </button>
        {deleting ? <WorkingBeside /> : null}
      </span>
      ) : null}
    </span>
  );
}

function AddressCard({
  title,
  initial,
  readOnly = false,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial: AddressPatch;
  readOnly?: boolean;
  onCancel: () => void;
  onSubmit: (patch: AddressPatch) => Promise<string | null | undefined>;
}) {
  const router = useRouter();
  const [patch, setPatch] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const dirty =
    patch.addressType !== initial.addressType ||
    patch.locationName !== initial.locationName ||
    patch.addressLine1 !== initial.addressLine1 ||
    patch.addressLine2 !== initial.addressLine2 ||
    patch.city !== initial.city ||
    patch.region !== initial.region ||
    patch.postalCode !== initial.postalCode ||
    patch.country !== initial.country;

  function close() {
    if (!saving) onCancel();
  }

  function persist() {
    start(async () => {
      const message = await onSubmit(patch);
      if (message) {
        setErr(message);
        return;
      }
      setErr(null);
      router.refresh();
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4"
      onClick={close}
    >
      <Card className="max-h-[90vh] w-full max-w-md overflow-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
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
        <AddressFields value={patch} onChange={setPatch} readOnly={readOnly} />
        {err ? (
          <DismissNote className="mt-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
            {err}
          </DismissNote>
        ) : null}
        {!readOnly && (dirty || saving) ? (
          <div className="mt-3 flex items-center gap-2">
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
      </Card>
    </div>,
    document.body,
  );
}

function AddressFields({
  value,
  onChange,
  readOnly = false,
}: {
  value: AddressPatch;
  onChange: (next: AddressPatch) => void;
  readOnly?: boolean;
}) {
  function set(key: keyof AddressPatch, next: string) {
    if (readOnly) return;
    onChange({ ...value, [key]: next });
  }
  const control = readOnly ? `${fieldClass} bg-stone-50 text-stone-700` : fieldClass;

  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <label className="col-span-2">
        <span className="text-xs text-stone-500">Location name</span>
        <input
          className={control}
          aria-label="Location name"
          value={value.locationName}
          disabled={readOnly}
          onChange={(e) => set("locationName", toSentenceCase(e.target.value))}
        />
      </label>
      <label className="col-span-2">
        <span className="text-xs text-stone-500">Type</span>
        <select
          className={control}
          aria-label="Type"
          value={value.addressType}
          disabled={readOnly}
          onChange={(e) => set("addressType", e.target.value)}
        >
          <option value="shipping">shipping</option>
          <option value="billing">billing</option>
          <option value="both">both</option>
        </select>
      </label>
      <label className="col-span-2">
        <span className="text-xs text-stone-500">Street</span>
        <input
          className={control}
          aria-label="Street"
          value={value.addressLine1}
          disabled={readOnly}
          onChange={(e) => set("addressLine1", e.target.value)}
        />
      </label>
      <label className="col-span-2">
        <span className="text-xs text-stone-500">Line 2</span>
        <input
          className={control}
          aria-label="Line 2"
          value={value.addressLine2}
          disabled={readOnly}
          onChange={(e) => set("addressLine2", e.target.value)}
        />
      </label>
      <label>
        <span className="text-xs text-stone-500">City</span>
        <input
          className={control}
          aria-label="City"
          value={value.city}
          disabled={readOnly}
          onChange={(e) => set("city", toSentenceCase(e.target.value))}
        />
      </label>
      <label>
        <span className="text-xs text-stone-500">Region</span>
        <select
          className={control}
          aria-label="Region"
          value={value.region}
          disabled={readOnly}
          onChange={(e) => set("region", e.target.value)}
        >
          <option value=""></option>
          {regionChoices(value.region).map((region) => (
            <option key={region.value} value={region.value}>
              {region.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-xs text-stone-500">Postal</span>
        <input
          className={control}
          aria-label="Postal"
          value={value.postalCode}
          disabled={readOnly}
          onChange={(e) => set("postalCode", e.target.value)}
        />
      </label>
      <label>
        <span className="text-xs text-stone-500">Country</span>
        <input
          className={control}
          aria-label="Country"
          value={value.country}
          disabled={readOnly}
          onChange={(e) => set("country", e.target.value)}
        />
      </label>
    </div>
  );
}

function line(...parts: (string | null | undefined)[]) {
  const text = parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
  return text || "";
}

function AddressRow({ address }: { address: CustomerAddress }) {
  const combined =
    line(
      address.address_line1,
      address.address_line2,
      line(address.city, address.region),
      address.postal_code,
      address.country,
    ) || "—";

  return (
    <SelectableRow id={address.id}>
      <td className="py-1.5">{address.location_name || "—"}</td>
      <td>{address.address_type}</td>
      <td>{combined}</td>
    </SelectableRow>
  );
}
