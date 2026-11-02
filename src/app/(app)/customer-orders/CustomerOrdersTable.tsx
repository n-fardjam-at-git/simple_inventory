"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DismissNote } from "@/components/DismissNote";
import { ComboBox } from "@/components/ComboBox";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { SysFolder, SysFolderOpen } from "@/components/icons/SysImages";
import { customerPickLabel } from "@/lib/customer";
import { WORKFLOW_STATUS, orderStatusLabel } from "@/lib/customer-order";
import { deleteCustomerOrder, updateCustomerOrderRow } from "./actions";

export type CustomerOrderRow = {
  id: string;
  order_no: number;
  customer_id: string;
  customer: string;
  account_no: number | null;
  account: string;
  start_date: string | null;
  status: string;
};

type Customer = { id: string; account_no: number; company_name: string; account_number: string | null };

export function CustomerOrdersTable({
  rows,
  customers,
}: {
  rows: CustomerOrderRow[];
  customers: Customer[];
}) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Order</th>
            <th>Customer</th>
            <th>Account</th>
            <th>Sage</th>
            <th>Start</th>
            <th>Status</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <OrderRow row={r} customers={customers} />}
    />
  );
}

function OrderRow({ row, customers }: { row: CustomerOrderRow; customers: Customer[] }) {
  const router = useRouter();
  const list = useList();
  const [customerId, setCustomerId] = useState(row.customer_id);
  const [startDate, setStartDate] = useState(row.start_date ?? "");
  const [status, setStatus] = useState(row.status);
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "save" | "delete">(null);
  const [err, setErr] = useState<string | null>(null);
  const workflow = WORKFLOW_STATUS.includes(row.status as (typeof WORKFLOW_STATUS)[number]);
  const picked = customers.find((c) => c.id === customerId);
  const dirty =
    customerId !== row.customer_id ||
    startDate !== (row.start_date ?? "") ||
    (workflow && status !== row.status);

  function persist() {
    return new Promise<boolean>((resolve) => {
      setJob("save");
      start(async () => {
        try {
          const message = await updateCustomerOrderRow(row.id, {
            customerId,
            startDate,
            status: workflow ? status : null,
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
      setCustomerId(row.customer_id);
      setStartDate(row.start_date ?? "");
      setStatus(row.status);
      setErr(null);
    },
    save: persist,
  });

  function openOrder() {
    const go = () => router.push(`/customer-orders/${row.id}`);
    if (editing && dirty) {
      list.tryLeave(go);
      return;
    }
    go();
  }

  return (
    <SelectableRow id={row.id}>
      <td className="py-1.5 tabular-nums">{row.order_no}</td>
      <td>
        {editing ? (
          <ComboBox
            required
            placeholder="Customer"
            value={customerId}
            onChange={setCustomerId}
            options={customers.map((c) => ({
              id: c.id,
              label: customerPickLabel(c),
            }))}
          />
        ) : (
          row.customer
        )}
      </td>
      <td className="tabular-nums">{editing ? (picked?.account_no ?? "—") : (row.account_no ?? "—")}</td>
      <td>{editing ? (picked?.account_number ?? "—") : row.account}</td>
      <td>
        {editing ? (
          <input
            type="date"
            aria-label="Start"
            className="rounded border px-1 py-0.5"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        ) : (
          <span className="tabular-nums">{row.start_date ?? "—"}</span>
        )}
      </td>
      <td>
        {editing && workflow ? (
          <select
            aria-label="Status"
            className="rounded border px-1 py-0.5"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {WORKFLOW_STATUS.map((item) => (
              <option key={item} value={item}>
                {orderStatusLabel(item)}
              </option>
            ))}
          </select>
        ) : (
          orderStatusLabel(row.status)
        )}
      </td>
      <td>
        <button
          type="button"
          className="group inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          aria-label="Open order"
          title="Open order"
          onClick={openOrder}
        >
          <SysFolder className="block group-hover:hidden" />
          <SysFolderOpen className="hidden group-hover:block" />
        </button>
      </td>
      <td className="py-1">
        <RowButtons
          editing={editing}
          dirty={dirty}
          saving={job === "save"}
          deleting={job === "delete"}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={() => {
            if (!confirm(`Delete order ${row.order_no}?`)) return;
            setJob("delete");
            start(async () => {
              try {
                const message = await deleteCustomerOrder(row.id);
                if (message) setErr(message);
              } finally {
                setJob(null);
              }
            });
          }}
        />
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
    </SelectableRow>
  );
}
