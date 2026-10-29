"use client";

import { DismissNote } from "@/components/DismissNote";
import { useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { ComboBox } from "@/components/ComboBox";
import { updateProfile } from "./actions";
import type { Role } from "@/lib/auth";

const ROLES: { id: Role; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "warehouse", label: "Warehouse" },
  { id: "sales_rep", label: "Sales rep" },
  { id: "customer", label: "Customer" },
  { id: "vendor", label: "Vendor" },
];

export type UserRow = {
  id: string;
  display_name: string;
  role: string;
  vendor_id: string | null;
  customer_id: string | null;
  vendor_name: string | null;
  customer_name: string | null;
};

export function UsersTable({
  rows,
  vendors,
  customers,
}: {
  rows: UserRow[];
  vendors: { id: string; name: string }[];
  customers: { id: string; name: string }[];
}) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Name</th>
            <th>Role</th>
            <th>Party</th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <UserEditRow row={r} vendors={vendors} customers={customers} />}
    />
  );
}

function partyLabel(row: UserRow) {
  if (row.role === "vendor") return row.vendor_name ?? "—";
  if (row.role === "customer") return row.customer_name ?? "—";
  return "—";
}

function UserEditRow({
  row,
  vendors,
  customers,
}: {
  row: UserRow;
  vendors: { id: string; name: string }[];
  customers: { id: string; name: string }[];
}) {
  const [name, setName] = useState(row.display_name);
  const [role, setRole] = useState(row.role);
  const [vendorId, setVendorId] = useState(row.vendor_id ?? "");
  const [customerId, setCustomerId] = useState(row.customer_id ?? "");
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "save">(null);
  const [err, setErr] = useState<string | null>(null);
  const list = useList();

  const dirty =
    name !== row.display_name ||
    role !== row.role ||
    vendorId !== (row.vendor_id ?? "") ||
    customerId !== (row.customer_id ?? "");

  function persist() {
    return new Promise<boolean>((resolve) => {
      setJob("save");
      start(async () => {
        try {
          const message = await updateProfile(row.id, {
            display_name: name,
            role,
            vendor_id: vendorId,
            customer_id: customerId,
          });
          if (message) {
            setErr(message);
            resolve(false);
          } else {
            setErr(null);
            list.finishEdit(row.id);
            resolve(true);
          }
        } finally {
          setJob(null);
        }
      });
    });
  }

  const { editing, requestEdit, requestCancel } = useListRow(row.id, {
    dirty,
    revert: () => {
      setName(row.display_name);
      setRole(row.role);
      setVendorId(row.vendor_id ?? "");
      setCustomerId(row.customer_id ?? "");
      setErr(null);
    },
    save: persist,
  });

  return (
    <SelectableRow id={row.id}>
      <td className="py-1.5">
        {editing ? (
          <input
            className="rounded border px-1 py-0.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Name"
          />
        ) : (
          row.display_name
        )}
      </td>
      <td>
        {editing ? (
          <select
            className="rounded border px-1 py-0.5"
            value={role}
            aria-label="Role"
            onChange={(e) => {
              const next = e.target.value;
              setRole(next);
              if (next !== "vendor") setVendorId("");
              if (next !== "customer") setCustomerId("");
            }}
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          ROLES.find((r) => r.id === row.role)?.label ?? row.role
        )}
      </td>
      <td>
        {editing && role === "vendor" ? (
          <ComboBox
            placeholder="Vendor"
            value={vendorId}
            onChange={setVendorId}
            options={vendors.map((v) => ({ id: v.id, label: v.name }))}
          />
        ) : editing && role === "customer" ? (
          <ComboBox
            allowEmpty
            placeholder="Customer"
            value={customerId}
            onChange={setCustomerId}
            options={customers.map((c) => ({ id: c.id, label: c.name }))}
          />
        ) : (
          partyLabel({ ...row, role, vendor_id: vendorId || null, customer_id: customerId || null })
        )}
      </td>
      <td className="py-1">
        <RowButtons
          editing={editing}
          dirty={dirty}
          saving={job === "save"}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
        />
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
    </SelectableRow>
  );
}
