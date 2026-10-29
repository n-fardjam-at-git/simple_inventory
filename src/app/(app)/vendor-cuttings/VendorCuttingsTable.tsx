"use client";

import Link from "next/link";
import { FitList } from "@/components/list/FitList";
import { SelectableRow } from "@/components/list/ListTable";
import { SysFolder, SysFolderOpen, SysPrint } from "@/components/icons/SysImages";
import type { VendorCuttingRow } from "./types";

export function VendorCuttingsTable({
  rows,
  onOpen,
  focusId = null,
  focusNonce = 0,
}: {
  rows: VendorCuttingRow[];
  onOpen: (id: string) => void;
  focusId?: string | null;
  focusNonce?: number;
}) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      focusId={focusId}
      focusNonce={focusNonce}
      stretch
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Cutting No</th>
            <th>Submitted</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => (
        <SelectableRow id={r.id}>
          <td className="py-1.5 tabular-nums">{r.order_num}</td>
          <td className="tabular-nums">{r.date_submitted}</td>
          <td>{r.open ? "Open" : "Closed"}</td>
          <td className="whitespace-nowrap">
            <div className="flex items-center gap-2">
              <Link
                href={`/cutting-orders/${r.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                aria-label="Print cutting"
                title="Print cutting"
                onClick={(e) => e.stopPropagation()}
              >
                <SysPrint />
              </Link>
              <button
                type="button"
                className="group inline-flex cursor-pointer rounded p-0.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                aria-label="Open cutting"
                title="Open cutting"
                onClick={() => onOpen(r.id)}
              >
                <SysFolder className="block group-hover:hidden" />
                <SysFolderOpen className="hidden group-hover:block" />
              </button>
            </div>
          </td>
        </SelectableRow>
      )}
    />
  );
}
