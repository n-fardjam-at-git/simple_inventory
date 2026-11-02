"use client";

import { useEffect, useState, useTransition, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Card, Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { toSentenceCase } from "@/lib/text-case";
import type { CustomerPatch } from "./actions";

const inputClass = "w-full rounded border py-1 pl-2 pr-6";

export function CustomerCard({
  title,
  initial,
  terms,
  reps,
  onDirtyChange,
  onCancel,
  onSubmit,
  persistRef,
}: {
  title: string;
  initial: CustomerPatch;
  terms: { id: string; term: string }[];
  reps: { id: string; name: string }[];
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSubmit: (patch: CustomerPatch) => Promise<string | null | undefined>;
  persistRef?: MutableRefObject<() => Promise<boolean>>;
}) {
  const [company, setCompany] = useState(initial.companyName);
  const [business, setBusiness] = useState(initial.businessName);
  const [account, setAccount] = useState(initial.accountNumber);
  const [contact, setContact] = useState(initial.contact);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [cellPhone, setCellPhone] = useState(initial.cellPhone);
  const [termId, setTermId] = useState(initial.paymentTermId);
  const [repId, setRepId] = useState(initial.salesRepId);
  const [hold, setHold] = useState(initial.doNotShip);
  const [notes, setNotes] = useState(initial.notes);
  const [active, setActive] = useState(initial.isActive);
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const patch: CustomerPatch = {
    companyName: company,
    businessName: business,
    accountNumber: account,
    contact,
    email,
    phone,
    cellPhone,
    paymentTermId: termId,
    salesRepId: repId,
    doNotShip: hold,
    notes,
    isActive: active,
  };
  const dirty =
    company !== initial.companyName ||
    business !== initial.businessName ||
    account !== initial.accountNumber ||
    contact !== initial.contact ||
    email !== initial.email ||
    phone !== initial.phone ||
    cellPhone !== initial.cellPhone ||
    termId !== initial.paymentTermId ||
    repId !== initial.salesRepId ||
    hold !== initial.doNotShip ||
    notes !== initial.notes ||
    active !== initial.isActive;

  function close() {
    if (!saving) onCancel();
  }

  function persist() {
    return new Promise<boolean>((resolve) => {
      start(async () => {
        const message = await onSubmit(patch);
        if (message) {
          setErr(message);
          resolve(false);
          return;
        }
        setErr(null);
        resolve(true);
      });
    });
  }

  if (persistRef) persistRef.current = persist;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

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
            <span className="mb-1 block text-xs text-stone-500">Name</span>
            <FieldClear onClear={() => setCompany("")}>
              <input
                className={inputClass}
                value={company}
                aria-label="Name"
                onChange={(e) => setCompany(toSentenceCase(e.target.value))}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Business name</span>
            <FieldClear onClear={() => setBusiness("")}>
              <input
                className={inputClass}
                value={business}
                aria-label="Business name"
                onChange={(e) => setBusiness(toSentenceCase(e.target.value))}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Sage account</span>
            <FieldClear onClear={() => setAccount("")}>
              <input
                className={inputClass}
                value={account}
                aria-label="Sage account"
                onChange={(e) => setAccount(e.target.value)}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Contact</span>
            <FieldClear onClear={() => setContact("")}>
              <input
                className={inputClass}
                value={contact}
                aria-label="Contact"
                onChange={(e) => setContact(toSentenceCase(e.target.value))}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Email</span>
            <FieldClear onClear={() => setEmail("")}>
              <input
                className={inputClass}
                value={email}
                aria-label="Email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Phone</span>
            <FieldClear onClear={() => setPhone("")}>
              <input
                className={inputClass}
                value={phone}
                aria-label="Phone"
                onChange={(e) => setPhone(e.target.value)}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Cell phone</span>
            <FieldClear onClear={() => setCellPhone("")}>
              <input
                className={inputClass}
                value={cellPhone}
                aria-label="Cell phone"
                onChange={(e) => setCellPhone(e.target.value)}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Sales rep</span>
            <FieldClear onClear={() => setRepId("")}>
              <ComboBox
                allowEmpty
                placeholder="Sales rep"
                aria-label="Sales rep"
                className={inputClass}
                value={repId}
                onChange={setRepId}
                options={reps.map((rep) => ({ id: rep.id, label: rep.name }))}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Terms</span>
            <FieldClear onClear={() => setTermId("")}>
              <ComboBox
                allowEmpty
                placeholder="Terms"
                aria-label="Terms"
                className={inputClass}
                value={termId}
                onChange={setTermId}
                options={terms.map((t) => ({ id: t.id, label: t.term }))}
              />
            </FieldClear>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Notes</span>
            <FieldClear top onClear={() => setNotes("")}>
              <textarea
                className={`${inputClass} min-h-16`}
                value={notes}
                aria-label="Notes"
                onChange={(e) => setNotes(e.target.value)}
              />
            </FieldClear>
          </label>
          <label className="block text-xs">
            <input
              type="checkbox"
              className="mr-1"
              checked={hold}
              onChange={(e) => setHold(e.target.checked)}
            />
            Do not ship
          </label>
          <label className="block text-xs">
            <input
              type="checkbox"
              className="mr-1"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
          {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
          {dirty || saving ? (
            <div className="flex items-center gap-2">
              <Btn type="button" busy={saving} onClick={() => void persist()}>
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
  children,
}: {
  onClear: () => void;
  top?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        className={`absolute right-1 z-10 px-0.5 text-sm leading-none text-stone-400 hover:text-stone-700 ${
          top ? "top-1.5" : "top-1/2 -translate-y-1/2"
        }`}
        aria-label="Clear"
        onClick={onClear}
      >
        ×
      </button>
    </div>
  );
}
