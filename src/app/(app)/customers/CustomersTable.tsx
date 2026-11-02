"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, useList, useListRow } from "@/components/list/ListTable";
import { createCustomer, deleteCustomer, updateCustomerRow, type CustomerPatch } from "./actions";
import { AddressPanel } from "./AddressPanel";
import { CustomerCard } from "./CustomerCard";
import { CustomerDetailsPanel, type CustomerAddress } from "./CustomerDetailsPanel";

export type CustomerRow = {
  id: string;
  account_no: number;
  company_name: string;
  business_name: string;
  account_number: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  cell_phone: string | null;
  payment_term_id: string | null;
  sales_rep_id: string | null;
  sales_rep_name: string;
  term: string;
  days_due: number | null;
  do_not_ship: boolean;
  notes: string | null;
  is_active: boolean;
};

export type TermOption = { id: string; term: string };
export type SalesRepOption = { id: string; name: string };

const blankCustomer: CustomerPatch = {
  companyName: "",
  businessName: "",
  accountNumber: "",
  contact: "",
  email: "",
  phone: "",
  cellPhone: "",
  paymentTermId: "",
  salesRepId: "",
  doNotShip: false,
  notes: "",
  isActive: true,
};

export function CustomersTable({
  rows,
  terms,
  reps,
  addresses,
  canEdit,
  focusId = null,
  focusNonce = 0,
}: {
  rows: CustomerRow[];
  terms: TermOption[];
  reps: SalesRepOption[];
  addresses: CustomerAddress[];
  canEdit: boolean;
  focusId?: string | null;
  focusNonce?: number;
}) {
  const router = useRouter();
  const openAddRef = useRef<() => void>(() => {});
  const openAddressesRef = useRef<() => void>(() => {});
  const addressLeaveRef = useRef<(after: () => void) => void>((after) => after());
  const editRef = useRef<(id: string) => void>(() => {});
  const cancelRef = useRef<(id: string) => void>(() => {});
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addressFor, setAddressFor] = useState<string | null>(null);
  const [pickedAddressId, setPickedAddressId] = useState<string | null>(null);
  const [addressFocusId, setAddressFocusId] = useState<string | null>(null);
  const [addressFocusNonce, setAddressFocusNonce] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);
  const onAddressSelect = useCallback((id: string | null) => setPickedAddressId(id), []);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const addressCustomer = rows.find((row) => row.id === addressFor) ?? null;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {canEdit ? (
          <div className="shrink-0">
            <Btn type="button" onClick={() => openAddRef.current()}>
              Add new customer
            </Btn>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <FitList
            items={rows}
            getKey={(r) => r.id}
            stretch
            focusId={focusId}
            focusNonce={focusNonce}
            thead={
              <thead>
                <AddBridge
                  onOpen={() => {
                    setAdding(true);
                  }}
                  openRef={openAddRef}
                />
                <SelectionBridge onSelect={onSelect} />
                <ActionBridge editRef={editRef} cancelRef={cancelRef} />
                <OpenBridge
                  openRef={openAddressesRef}
                  onOpen={() => {
                    if (!selected) return;
                    const customerId = selected.id;
                    const picked =
                      pickedAddressId &&
                      addresses.some(
                        (address) =>
                          address.id === pickedAddressId && address.customer_id === customerId,
                      )
                        ? pickedAddressId
                        : null;
                    addressLeaveRef.current(() => {
                      setAddressFor(customerId);
                      setAddressFocusId(picked);
                      if (picked) setAddressFocusNonce((n) => n + 1);
                    });
                  }}
                />
                <tr className="text-stone-500">
                  <th className="py-1">Account</th>
                  <th>Name</th>
                  <th>Business name</th>
                  <th>Sales rep</th>
                  <th></th>
                  <th>Status</th>
                </tr>
              </thead>
            }
            renderRow={(r) => <CustomerEditRow row={r} terms={terms} reps={reps} />}
          />
        </div>
        <CustomerDetailsPanel
          customer={selected}
          addresses={addresses.filter((address) => address.customer_id === selected?.id)}
          canEdit={canEdit}
          deleting={deleting}
          deleteError={deleteErr}
          onDismissDeleteError={() => setDeleteErr(null)}
          onOpenAddresses={() => openAddressesRef.current()}
          onAddressSelect={onAddressSelect}
          onEdit={() => {
            if (!selected) return;
            setAdding(false);
            editRef.current(selected.id);
          }}
          onDelete={() => {
            if (!selected || deleting) return;
            if (!confirm(`Delete ${selected.company_name}?`)) return;
            const id = selected.id;
            setDeleteErr(null);
            setDeleting(true);
            start(async () => {
              try {
                const message = await deleteCustomer(id);
                if (message) setDeleteErr(message);
                else {
                  cancelRef.current(id);
                  router.refresh();
                }
              } finally {
                setDeleting(false);
              }
            });
          }}
        />
        </div>
      </div>
      <AddressPanel
        key={addressFor ?? "closed"}
        open={addressCustomer != null}
        customer={addressCustomer}
        addresses={addresses.filter((address) => address.customer_id === addressCustomer?.id)}
        canEdit={canEdit}
        focusId={addressFocusId}
        focusNonce={addressFocusNonce}
        onClose={() => setAddressFor(null)}
        beforeSwitch={addressLeaveRef}
      />
      {adding ? (
        <CustomerCard
          title="New customer"
          initial={blankCustomer}
          terms={terms}
          reps={reps}
          onDirtyChange={() => {}}
          onCancel={() => setAdding(false)}
          onSubmit={async (patch) => {
            const message = await createCustomer(patch);
            if (message) return message;
            setAdding(false);
            router.refresh();
            return null;
          }}
        />
      ) : null}
    </>
  );
}

function SelectionBridge({ onSelect }: { onSelect: (id: string | null) => void }) {
  const { selectedId } = useList();
  useEffect(() => {
    onSelect(selectedId);
  }, [onSelect, selectedId]);
  return null;
}

function ActionBridge({
  editRef,
  cancelRef,
}: {
  editRef: { current: (id: string) => void };
  cancelRef: { current: (id: string) => void };
}) {
  const list = useList();
  editRef.current = (id) => list.requestEdit(id);
  cancelRef.current = (id) => list.requestCancel(id);
  return null;
}

function OpenBridge({
  openRef,
  onOpen,
}: {
  openRef: { current: () => void };
  onOpen: () => void;
}) {
  const list = useList();
  openRef.current = () => list.tryLeave(onOpen);
  return null;
}

function AddBridge({
  onOpen,
  openRef,
}: {
  onOpen: () => void;
  openRef: { current: () => void };
}) {
  const list = useList();
  openRef.current = () => list.tryLeave(onOpen);
  return null;
}

function patchFromRow(row: CustomerRow): CustomerPatch {
  return {
    companyName: row.company_name,
    businessName: row.business_name,
    accountNumber: row.account_number ?? "",
    contact: row.contact ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    cellPhone: row.cell_phone ?? "",
    paymentTermId: row.payment_term_id ?? "",
    salesRepId: row.sales_rep_id ?? "",
    doNotShip: row.do_not_ship,
    notes: row.notes ?? "",
    isActive: row.is_active,
  };
}

function CustomerEditRow({
  row,
  terms,
  reps,
}: {
  row: CustomerRow;
  terms: TermOption[];
  reps: SalesRepOption[];
}) {
  const router = useRouter();
  const persistRef = useRef<() => Promise<boolean>>(async () => false);
  const [popupDirty, setPopupDirty] = useState(false);

  const { editing, requestCancel, finishEdit } = useListRow(row.id, {
    dirty: popupDirty,
    revert: () => setPopupDirty(false),
    save: () => persistRef.current(),
  });

  return (
    <SelectableRow id={row.id} dimmed={!row.is_active}>
      <td className="py-1.5 tabular-nums">{row.account_no}</td>
      <td>{row.company_name}</td>
      <td>{row.business_name}</td>
      <td>{row.sales_rep_name || "—"}</td>
      <td>{row.do_not_ship ? <span className="text-red-700">Do not ship</span> : null}</td>
      <td>{row.is_active ? "Active" : "Inactive"}</td>
      {editing ? (
        <CustomerCard
          title={row.company_name}
          initial={patchFromRow(row)}
          terms={terms}
          reps={reps}
          persistRef={persistRef}
          onDirtyChange={setPopupDirty}
          onCancel={requestCancel}
          onSubmit={async (patch) => {
            const message = await updateCustomerRow(row.id, patch);
            if (message) return message;
            setPopupDirty(false);
            finishEdit();
            router.refresh();
            return null;
          }}
        />
      ) : null}
    </SelectableRow>
  );
}
