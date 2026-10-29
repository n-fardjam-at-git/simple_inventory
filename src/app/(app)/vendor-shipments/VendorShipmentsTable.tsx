"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Busy } from "@/components/WorkingBeside";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { ComboBox } from "@/components/ComboBox";
import { SysFolder, SysFolderOpen, SysPost, SysPrint } from "@/components/icons/SysImages";
import {
  deleteVendorShipment,
  postVendorShipment,
  updateVendorShipment,
} from "./actions";

export type VendorShipmentRow = {
  id: string;
  shipment_num: number;
  vendor_id: string | null;
  received_date: string;
  air_way_no: string | null;
  posted: boolean;
  has_lines: boolean;
  vendors: { name: string } | null;
};

type Vendor = { id: string; name: string; is_active?: boolean };

export function VendorShipmentsTable({
  rows,
  vendors,
  onOpen,
  focusId = null,
  focusNonce = 0,
}: {
  rows: VendorShipmentRow[];
  vendors: Vendor[];
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
            <th className="py-1">Shipment No</th>
            <th>Vendor</th>
            <th>Received</th>
            <th>Air way</th>
            <th>Status</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <ShipmentRow row={r} vendors={vendors} onOpen={onOpen} />}
    />
  );
}

function ShipmentRow({
  row,
  vendors,
  onOpen,
}: {
  row: VendorShipmentRow;
  vendors: Vendor[];
  onOpen: (id: string) => void;
}) {
  const [vendorId, setVendorId] = useState(row.vendor_id ?? "");
  const [received, setReceived] = useState(row.received_date);
  const [airWay, setAirWay] = useState(row.air_way_no ?? "");
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "save" | "delete" | "post">(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmPost, setConfirmPost] = useState(false);
  const list = useList();
  const router = useRouter();

  useEffect(() => {
    if (!confirmPost) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setConfirmPost(false);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [confirmPost]);

  function runPost() {
    setJob("post");
    start(async () => {
      try {
        const message = await postVendorShipment(row.id);
        if (message) setErr(message);
        else {
          setErr(null);
          setConfirmPost(false);
          router.refresh();
        }
      } finally {
        setJob(null);
      }
    });
  }
  const vendorLocked = row.has_lines;

  const snapshot = {
    vendorId: row.vendor_id ?? "",
    received: row.received_date,
    airWay: row.air_way_no ?? "",
  };
  const dirty =
    vendorId !== snapshot.vendorId ||
    received !== snapshot.received ||
    airWay !== snapshot.airWay;

  function persist() {
    return new Promise<boolean>((resolve) => {
      setJob("save");
      start(async () => {
        try {
          const message = await updateVendorShipment(row.id, {
            vendor_id: vendorId,
            received_date: received,
            air_way_no: airWay,
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
      setVendorId(snapshot.vendorId);
      setReceived(snapshot.received);
      setAirWay(snapshot.airWay);
      setErr(null);
    },
    save: persist,
  });

  useEffect(() => {
    if (editing) setConfirmPost(false);
  }, [editing]);

  useEffect(() => {
    if (editing) return;
    setVendorId(row.vendor_id ?? "");
    setReceived(row.received_date);
    setAirWay(row.air_way_no ?? "");
  }, [row.vendor_id, row.received_date, row.air_way_no, editing]);

  return (
    <SelectableRow id={row.id} dimmed={row.posted}>
      <td className="py-1.5 font-medium tabular-nums">{row.shipment_num}</td>
      <td>
        {editing && !row.posted && !vendorLocked ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            required
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
        {editing && !row.posted ? (
          <input
            type="date"
            className="rounded border px-1 py-0.5"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            aria-label="Date received"
          />
        ) : (
          row.received_date
        )}
      </td>
      <td>
        {editing && !row.posted ? (
          <input
            className="rounded border px-1 py-0.5"
            value={airWay}
            onChange={(e) => setAirWay(e.target.value)}
            aria-label="Air way number"
          />
        ) : (
          row.air_way_no ?? ""
        )}
      </td>
      <td>{row.posted ? "Posted" : "Open"}</td>
      <td className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          {list.editingId ? null : (
            <Link
              href={`/vendor-shipments/${row.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              aria-label="Print shipment"
              title="Print shipment"
              onClick={(e) => e.stopPropagation()}
            >
              <SysPrint />
            </Link>
          )}
          {list.editingId ? null : (
            <button
              type="button"
              className="inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Post shipment"
              title={
                row.posted
                  ? "Already posted"
                  : row.has_lines
                    ? "Post shipment"
                    : "Add a product first"
              }
              disabled={job != null || row.posted || !row.has_lines}
              onClick={() => setConfirmPost(true)}
            >
              <SysPost />
            </button>
          )}
          {editing ? null : (
            <button
              type="button"
              className="group inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              aria-label="Open shipment"
              title="Open shipment"
              onClick={() => onOpen(row.id)}
            >
              <SysFolder className="block group-hover:hidden" />
              <SysFolderOpen className="hidden group-hover:block" />
            </button>
          )}
        </div>
      </td>
      <td className="py-1">
        {row.posted ? null : (
          <RowButtons
            editing={editing}
            dirty={dirty}
            saving={job === "save"}
            deleting={job === "delete"}
            onEdit={requestEdit}
            onSave={() => void persist()}
            onCancel={requestCancel}
            onDelete={() => {
              if (!confirm(`Delete shipment ${row.shipment_num}?`)) return;
              setJob("delete");
              start(async () => {
                try {
                  const message = await deleteVendorShipment(row.id);
                  if (message) setErr(message);
                } finally {
                  setJob(null);
                }
              });
            }}
          />
        )}
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      {confirmPost && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40">
              <div className="max-w-sm rounded-lg bg-white p-4 shadow-lg">
                <p className="mb-4 text-sm">
                  Post shipment {row.shipment_num} to inventory?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-stone-300 px-3 py-1.5 text-sm"
                    disabled={job === "post"}
                    onClick={() => setConfirmPost(false)}
                  >
                    Cancel
                  </button>
                  <Busy on={job === "post"}>
                    <button
                      type="button"
                      className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                      disabled={job === "post"}
                      onClick={runPost}
                    >
                      Post
                    </button>
                  </Busy>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </SelectableRow>
  );
}
