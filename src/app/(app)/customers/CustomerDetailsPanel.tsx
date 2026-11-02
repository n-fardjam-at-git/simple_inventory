"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui";
import { DismissNote } from "@/components/DismissNote";
import { WorkingBeside } from "@/components/WorkingBeside";
import { SysFolder, SysFolderOpen, SysStop } from "@/components/icons/SysImages";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, useList } from "@/components/list/ListTable";
import type { CustomerRow } from "./CustomersTable";

export type CustomerAddress = {
  id: string;
  customer_id: string;
  address_type: string;
  location_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
};

function line(...parts: (string | null | undefined)[]) {
  const text = parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
  return text || null;
}

function combinedAddress(address: CustomerAddress) {
  return (
    line(
      address.address_line1,
      address.address_line2,
      line(address.city, address.region),
      address.postal_code,
      address.country,
    ) ?? ""
  );
}

function termsText(customer: CustomerRow) {
  if (!customer.term) return "—";
  if (customer.days_due == null) return customer.term;
  const days = customer.days_due === 1 ? "1 day" : `${customer.days_due} days`;
  return `${customer.term} · ${days}`;
}

export function CustomerDetailsPanel({
  customer,
  addresses,
  canEdit,
  deleting,
  deleteError,
  onDismissDeleteError,
  onOpenAddresses,
  onEdit,
  onDelete,
  onAddressSelect,
}: {
  customer: CustomerRow | null;
  addresses: CustomerAddress[];
  canEdit: boolean;
  deleting: boolean;
  deleteError: string | null;
  onDismissDeleteError: () => void;
  onOpenAddresses: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddressSelect: (id: string | null) => void;
}) {
  return (
    <Card className="flex min-h-0 w-[40rem] shrink-0 flex-col overflow-hidden">
      {customer ? (
        <>
          <div className="-mx-4 -mt-4 flex shrink-0 items-center justify-between gap-3 border-b border-stone-300 px-4">
            <div className="min-w-0 py-2">
              <h2 className="truncate text-sm font-bold text-stone-500">{customer.company_name}</h2>
              {customer.do_not_ship ? (
                <p className="text-xs text-red-700">Do not ship</p>
              ) : null}
            </div>
            {canEdit ? (
              <div className="inline-flex shrink-0 items-center gap-2 rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
                <button type="button" className="text-xs text-stone-700 underline" onClick={onEdit}>
                  Edit
                </button>
                <span className="relative">
                  <button
                    type="button"
                    className="text-xs text-red-700 underline"
                    onClick={() => {
                      if (!deleting) onDelete();
                    }}
                  >
                    Delete
                  </button>
                  {deleting ? <WorkingBeside /> : null}
                </span>
              </div>
            ) : null}
          </div>
          {deleteError ? (
            <DismissNote className="mt-3 text-xs text-red-700" onDismiss={onDismissDeleteError}>
              {deleteError}
            </DismissNote>
          ) : null}
          <dl className="mt-4 grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Detail label="Account" value={String(customer.account_no)} />
            <Detail label="Sage account" value={customer.account_number || "—"} />
            <Detail label="Business name" value={customer.business_name} />
            <Detail label="Sales rep" value={customer.sales_rep_name || "—"} />
            <Detail label="Contact" value={customer.contact || "—"} />
            <Detail label="Email" value={customer.email || "—"} />
            <Detail label="Phone" value={customer.phone || "—"} />
            <Detail label="Cell phone" value={customer.cell_phone || "—"} />
            <Detail label="Terms" value={termsText(customer)} />
            <Detail
              label="Status"
              value={customer.is_active ? "Active" : "Inactive"}
              mark={customer.do_not_ship ? <SysStop /> : null}
            />
            <Detail label="Notes" value={customer.notes || "—"} wide />
          </dl>
          <button
            type="button"
            className="group -mx-4 mt-5 flex shrink-0 cursor-pointer items-center gap-2 border-y border-stone-300 px-4 py-2 text-left text-sm font-bold text-stone-500 hover:bg-stone-50"
            onClick={onOpenAddresses}
          >
            Addresses
            <SysFolder className="block group-hover:hidden" />
            <SysFolderOpen className="hidden group-hover:block" />
          </button>
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <FitList
              items={addresses}
              getKey={(address) => address.id}
              stretch
              thead={
                <thead>
                  <AddressSelectionBridge onSelect={onAddressSelect} />
                  <tr className="text-stone-500">
                    <th className="py-1">Location name</th>
                    <th>Type</th>
                    <th>Address</th>
                  </tr>
                </thead>
              }
              renderRow={(address) => (
                <SelectableRow id={address.id}>
                  <td className="py-1.5">{address.location_name || "—"}</td>
                  <td>{address.address_type}</td>
                  <td>{combinedAddress(address) || "—"}</td>
                </SelectableRow>
              )}
            />
          </div>
        </>
      ) : (
        <p className="m-auto text-sm text-stone-500">Select a customer.</p>
      )}
    </Card>
  );
}

function AddressSelectionBridge({ onSelect }: { onSelect: (id: string | null) => void }) {
  const { selectedId } = useList();
  useEffect(() => {
    onSelect(selectedId);
  }, [onSelect, selectedId]);
  return null;
}

function Detail({
  label,
  value,
  wide,
  mark,
}: {
  label: string;
  value: string;
  wide?: boolean;
  mark?: React.ReactNode;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className={mark ? "flex items-center gap-2" : "whitespace-pre-wrap"}>
        {mark ? <span>{value}</span> : value}
        {mark}
      </dd>
    </div>
  );
}
