"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Busy } from "@/components/WorkingBeside";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { SysFolder, SysFolderOpen, SysSend } from "@/components/icons/SysImages";
import {
  acceptVendorAdvice,
  deleteVendorAdvice,
  returnVendorAdvice,
  submitVendorAdvice,
  updateVendorAdvice,
} from "./actions";

export type AdviceRow = {
  id: string;
  advice_num: number;
  vendor_id: string;
  vendor_name: string | null;
  ship_date: string | null;
  air_way_no: string | null;
  notes: string | null;
  status: string;
};

const STATUS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  accepted: "Accepted",
};

export function VendorAdvicesTable({
  rows,
  viewer,
  onOpen,
}: {
  rows: AdviceRow[];
  viewer: "vendor" | "staff";
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
            <th className="py-1">Packing list No</th>
            {viewer === "staff" ? <th>Vendor</th> : null}
            <th>Ship date</th>
            <th>Air way</th>
            <th>Notes</th>
            <th>Status</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <AdviceEditRow row={r} viewer={viewer} onOpen={onOpen} />}
    />
  );
}

function AdviceEditRow({
  row,
  viewer,
  onOpen,
}: {
  row: AdviceRow;
  viewer: "vendor" | "staff";
  onOpen: (id: string) => void;
}) {
  const [shipDate, setShipDate] = useState(row.ship_date ?? "");
  const [airWay, setAirWay] = useState(row.air_way_no ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "save" | "delete" | "ask">(null);
  const [err, setErr] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | "submit" | "accept" | "return">(null);
  const list = useList();
  const router = useRouter();
  const draft = row.status === "draft";
  const canEdit = viewer === "vendor" && draft;

  const dirty =
    shipDate !== (row.ship_date ?? "") ||
    airWay !== (row.air_way_no ?? "") ||
    notes !== (row.notes ?? "");

  function persist() {
    return new Promise<boolean>((resolve) => {
      setJob("save");
      start(async () => {
        try {
          const message = await updateVendorAdvice(row.id, {
            ship_date: shipDate,
            air_way_no: airWay,
            notes,
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
      setShipDate(row.ship_date ?? "");
      setAirWay(row.air_way_no ?? "");
      setNotes(row.notes ?? "");
      setErr(null);
    },
    save: persist,
  });

  useEffect(() => {
    if (!ask) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setAsk(null);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ask]);

  function runAsk() {
    const action =
      ask === "submit"
        ? submitVendorAdvice
        : ask === "accept"
          ? acceptVendorAdvice
          : returnVendorAdvice;
    setJob("ask");
    start(async () => {
      try {
        const message = await action(row.id);
        if (message) setErr(message);
        else {
          setErr(null);
          setAsk(null);
          router.refresh();
        }
      } finally {
        setJob(null);
      }
    });
  }

  return (
    <SelectableRow id={row.id}>
      <td className="py-1.5 tabular-nums">{row.advice_num}</td>
      {viewer === "staff" ? <td>{row.vendor_name ?? "—"}</td> : null}
      <td>
        {editing && canEdit ? (
          <input
            type="date"
            className="rounded border px-1 py-0.5"
            value={shipDate}
            onChange={(e) => setShipDate(e.target.value)}
            aria-label="Ship date"
          />
        ) : (
          row.ship_date ?? ""
        )}
      </td>
      <td>
        {editing && canEdit ? (
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
      <td>
        {editing && canEdit ? (
          <input
            className="w-full rounded border px-1 py-0.5"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label="Notes"
          />
        ) : (
          row.notes ?? ""
        )}
      </td>
      <td>{STATUS[row.status] ?? row.status}</td>
      <td className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          {viewer === "vendor" && !editing ? (
            <button
              type="button"
              className="inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Submit packing list"
              title={draft ? "Submit packing list" : "Already submitted"}
              disabled={job != null || !draft}
              onClick={() => setAsk("submit")}
            >
              <SysSend />
            </button>
          ) : null}
          {viewer === "staff" && row.status === "submitted" ? (
            <>
              <button
                type="button"
                className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100"
                onClick={() => setAsk("accept")}
              >
                Accept
              </button>
              <button
                type="button"
                className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100"
                onClick={() => setAsk("return")}
              >
                Return
              </button>
            </>
          ) : null}
          {editing ? null : (
            <button
              type="button"
              className="group inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              aria-label="Open packing list"
              title="Open packing list"
              onClick={() => onOpen(row.id)}
            >
              <SysFolder className="block group-hover:hidden" />
              <SysFolderOpen className="hidden group-hover:block" />
            </button>
          )}
        </div>
      </td>
      <td className="py-1">
        {canEdit ? (
          <RowButtons
            editing={editing}
            dirty={dirty}
            saving={job === "save"}
            deleting={job === "delete"}
            onEdit={requestEdit}
            onSave={() => void persist()}
            onCancel={requestCancel}
            onDelete={() => {
              if (!confirm(`Delete packing list ${row.advice_num}?`)) return;
              setJob("delete");
              start(async () => {
                try {
                  const message = await deleteVendorAdvice(row.id);
                  if (message) setErr(message);
                  else router.refresh();
                } finally {
                  setJob(null);
                }
              });
            }}
          />
        ) : null}
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      {ask && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40">
              <div className="max-w-sm rounded-lg bg-white p-4 shadow-lg">
                <p className="mb-4 text-sm">
                  {ask === "submit"
                    ? `Submit packing list ${row.advice_num}?`
                    : ask === "accept"
                      ? `Accept packing list ${row.advice_num} into an unposted shipment?`
                      : `Return packing list ${row.advice_num} to the vendor?`}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-stone-300 px-3 py-1.5 text-sm"
                    disabled={job === "ask"}
                    onClick={() => setAsk(null)}
                  >
                    Cancel
                  </button>
                  <Busy on={job === "ask"}>
                    <button
                      type="button"
                      className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                      disabled={job === "ask"}
                      onClick={runAsk}
                    >
                      {ask === "submit" ? "Submit" : ask === "accept" ? "Accept" : "Return"}
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
