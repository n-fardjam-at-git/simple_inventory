"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Busy } from "@/components/WorkingBeside";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { ComboBox } from "@/components/ComboBox";
import { cuttingOrderLabel } from "@/lib/cutting-order";
import {
  SysFolder,
  SysFolderOpen,
  SysPrint,
  SysSend,
} from "@/components/icons/SysImages";
import { deleteCuttingOrder, submitCuttingOrder, updateCuttingOrder } from "./actions";

export type CuttingOrderRow = {
  id: string;
  order_num: number;
  vendor_id: string;
  brand_id: string;
  arrival_date: string;
  date_submitted: string | null;
  reference: string | null;
  status: boolean;
  has_lots: boolean;
  qty_ordered: number;
  qty_received: number;
  vendors: { name: string } | null;
  brands: { name: string } | null;
};

type Vendor = { id: string; name: string; is_active?: boolean };
type Brand = { id: string; name: string; is_active?: boolean };

export function CuttingOrdersTable({
  rows,
  vendors,
  brands,
  onOpen,
  focusId = null,
  focusNonce = 0,
}: {
  rows: CuttingOrderRow[];
  vendors: Vendor[];
  brands: Brand[];
  onOpen: (id: string) => void;
  focusId?: string | null;
  focusNonce?: number;
}) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      focusId={focusId}
      focusNonce={focusNonce}
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Order No</th>
            <th>Vendor</th>
            <th>Brand</th>
            <th>Submitted</th>
            <th>Arrival</th>
            <th>Status</th>
            <th>PO No</th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <OrderRow row={r} vendors={vendors} brands={brands} onOpen={onOpen} />}
    />
  );
}

function OrderRow({
  row,
  vendors,
  brands,
  onOpen,
}: {
  row: CuttingOrderRow;
  vendors: Vendor[];
  brands: Brand[];
  onOpen: (id: string) => void;
}) {
  const [vendorId, setVendorId] = useState(row.vendor_id);
  const [brandId, setBrandId] = useState(row.brand_id);
  const [arrival, setArrival] = useState(row.arrival_date);
  const [submitted, setSubmitted] = useState(row.date_submitted ?? "");
  const [reference, setReference] = useState(row.reference ?? "");
  const [status, setStatus] = useState(row.status);
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "save" | "delete" | "send">(null);
  const [err, setErr] = useState<string | null>(null);
  const list = useList();
  const router = useRouter();
  const brandLocked = row.has_lots;

  const snapshot = {
    vendorId: row.vendor_id,
    brandId: row.brand_id,
    arrival: row.arrival_date,
    submitted: row.date_submitted ?? "",
    reference: row.reference ?? "",
    status: row.status,
  };
  const dirty =
    vendorId !== snapshot.vendorId ||
    brandId !== snapshot.brandId ||
    arrival !== snapshot.arrival ||
    submitted !== snapshot.submitted ||
    reference !== snapshot.reference ||
    status !== snapshot.status;

  function persist() {
    return new Promise<boolean>((resolve) => {
      setJob("save");
      start(async () => {
        try {
          const message = await updateCuttingOrder(row.id, {
            vendor_id: vendorId,
            brand_id: brandId,
            arrival_date: arrival,
            date_submitted: submitted,
            reference,
            status,
          });
          if (message) {
            setErr(message);
            resolve(false);
          } else {
            setErr(null);
            list.finishEdit(row.id);
            router.refresh();
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
      setVendorId(snapshot.vendorId);
      setBrandId(snapshot.brandId);
      setArrival(snapshot.arrival);
      setSubmitted(snapshot.submitted);
      setReference(snapshot.reference);
      setStatus(snapshot.status);
      setErr(null);
    },
    save: persist,
  });

  useEffect(() => {
    if (editing) return;
    setStatus(row.status);
    setVendorId(row.vendor_id);
    setBrandId(row.brand_id);
    setArrival(row.arrival_date);
    setSubmitted(row.date_submitted ?? "");
    setReference(row.reference ?? "");
  }, [row.status, row.vendor_id, row.brand_id, row.arrival_date, row.date_submitted, row.reference, editing]);

  const label = cuttingOrderLabel(row.order_num);

  return (
    <SelectableRow id={row.id} dimmed={!row.status}>
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
        {editing && !brandLocked ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            value={brandId}
            onChange={setBrandId}
            options={brands
              .filter((b) => b.is_active !== false || b.id === brandId)
              .map((b) => ({ id: b.id, label: b.name }))}
          />
        ) : (
          row.brands?.name ?? "—"
        )}
      </td>
      <td>
        {editing ? (
          <input
            type="date"
            className="rounded border px-1 py-0.5"
            value={submitted}
            onChange={(e) => setSubmitted(e.target.value)}
            aria-label="Date submitted"
          />
        ) : (
          row.date_submitted ?? ""
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
          <div>
            <div className="flex flex-wrap items-center gap-x-1 text-sm">
              <label>
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={status}
                  onChange={(e) => {
                    if (e.target.checked && !row.status) {
                      setErr("! No open items");
                      return;
                    }
                    setErr(null);
                    setStatus(e.target.checked);
                  }}
                />
                Open
              </label>
              <span className="text-xs font-light tabular-nums text-stone-500">
                • {row.qty_received} of {row.qty_ordered}
              </span>
            </div>
            {err === "! No open items" ? (
              <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote>
            ) : null}
          </div>
        ) : (
          <span>
            {row.status ? "Open" : "Closed"}
            <span className="ml-1 text-xs font-light tabular-nums text-stone-500">
              • {row.qty_received} of {row.qty_ordered}
            </span>
          </span>
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
        {editing ? null : (
          <Link
            href={`/cutting-orders/${row.id}/print`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            aria-label="Print order"
            title="Print order"
            onClick={(e) => e.stopPropagation()}
          >
            <SysPrint />
          </Link>
        )}
      </td>
      <td>
        {editing ? null : (
          <Busy on={job === "send"}>
            <button
              type="button"
              className="inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
              aria-label="Send order"
              title="Send order"
              disabled={job === "send"}
              onClick={() => {
                setJob("send");
                start(async () => {
                  try {
                    const message = await submitCuttingOrder(row.id);
                    if (message) setErr(message);
                    else router.refresh();
                  } finally {
                    setJob(null);
                  }
                });
              }}
            >
              <SysSend />
            </button>
          </Busy>
        )}
      </td>
      <td>
        <button
          type="button"
          className="group inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          aria-label="Open order"
          title="Open order"
          onClick={() => {
            if (editing && dirty) {
              list.tryLeave(() => onOpen(row.id));
              return;
            }
            onOpen(row.id);
          }}
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
            if (!confirm(`Delete ${label}?`)) return;
            setJob("delete");
            start(async () => {
              try {
                const message = await deleteCuttingOrder(row.id);
                if (message) setErr(message);
              } finally {
                setJob(null);
              }
            });
          }}
        />
        {err && err !== "! No open items" ? (
          <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote>
        ) : null}
      </td>
    </SelectableRow>
  );
}
