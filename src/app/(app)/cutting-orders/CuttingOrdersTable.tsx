"use client";

import { useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { ComboBox } from "@/components/ComboBox";
import { cuttingOrderLabel } from "@/lib/cutting-order";
import { deleteCuttingOrder, updateCuttingOrder } from "./actions";

export type CuttingOrderRow = {
  id: string;
  order_num: number;
  vendor_id: string;
  arrival_date: string;
  reference: string | null;
  status: string;
  vendors: { name: string } | null;
};

type Vendor = { id: string; name: string; is_active?: boolean };

const STATUSES = [
  { id: "open", label: "open" },
  { id: "received", label: "received" },
  { id: "cancelled", label: "cancelled" },
];

export function CuttingOrdersTable({
  rows,
  vendors,
  onOpen,
}: {
  rows: CuttingOrderRow[];
  vendors: Vendor[];
  onOpen: (id: string) => void;
}) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Order No</th>
            <th>Vendor</th>
            <th>Arrival</th>
            <th>Status</th>
            <th>PO No</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <OrderRow row={r} vendors={vendors} onOpen={onOpen} />}
    />
  );
}

function OrderRow({
  row,
  vendors,
  onOpen,
}: {
  row: CuttingOrderRow;
  vendors: Vendor[];
  onOpen: (id: string) => void;
}) {
  const [vendorId, setVendorId] = useState(row.vendor_id);
  const [arrival, setArrival] = useState(row.arrival_date);
  const [reference, setReference] = useState(row.reference ?? "");
  const [status, setStatus] = useState(row.status);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const list = useList();

  const snapshot = {
    vendorId: row.vendor_id,
    arrival: row.arrival_date,
    reference: row.reference ?? "",
    status: row.status,
  };
  const dirty =
    vendorId !== snapshot.vendorId ||
    arrival !== snapshot.arrival ||
    reference !== snapshot.reference ||
    status !== snapshot.status;

  function persist() {
    return new Promise<boolean>((resolve) => {
      start(async () => {
        const message = await updateCuttingOrder(row.id, {
          vendor_id: vendorId,
          arrival_date: arrival,
          reference,
          status,
        });
        if (message) {
          setErr(message);
          resolve(false);
        } else {
          setErr(null);
          list.finishEdit(row.id);
          resolve(true);
        }
      });
    });
  }
  const { editing, requestEdit, requestCancel } = useListRow(row.id, {
    dirty,
    revert: () => {
      setVendorId(snapshot.vendorId);
      setArrival(snapshot.arrival);
      setReference(snapshot.reference);
      setStatus(snapshot.status);
      setErr(null);
    },
    save: persist,
  });

  const label = cuttingOrderLabel(row.order_num);

  return (
    <SelectableRow id={row.id} dimmed={row.status === "cancelled"}>
      <td className="py-1.5 font-medium">{row.order_num}</td>
      <td>
        {editing ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            value={vendorId}
            onChange={setVendorId}
            options={vendors
              .filter((v) => v.is_active !== false || v.id === vendorId)
              .map((v) => ({ id: v.id, label: v.name }))}
          />
        ) : (
          row.vendors?.name ?? "—"
        )}
      </td>
      <td>
        {editing ? (
          <input
            type="date"
            className="rounded border px-1 py-0.5"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
          />
        ) : (
          row.arrival_date
        )}
      </td>
      <td>
        {editing ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            value={status}
            onChange={setStatus}
            options={STATUSES}
          />
        ) : (
          row.status
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="rounded border px-1 py-0.5"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            aria-label="PO No"
          />
        ) : (
          row.reference ?? ""
        )}
      </td>
      <td>
        <button
          type="button"
          className="text-xs text-stone-700 underline"
          onClick={() => {
            if (editing && dirty) {
              list.tryLeave(() => onOpen(row.id));
              return;
            }
            onOpen(row.id);
          }}
        >
          Open
        </button>
      </td>
      <td className="py-1">
        <RowButtons
          editing={editing}
          dirty={dirty}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={() => {
            if (!confirm(`Delete ${label}?`)) return;
            start(async () => {
              const message = await deleteCuttingOrder(row.id);
              if (message) setErr(message);
            });
          }}
        />
        {err ? <p className="text-xs text-red-700">{err}</p> : null}
        {pending ? <p className="text-xs text-stone-400">Working…</p> : null}
      </td>
    </SelectableRow>
  );
}
