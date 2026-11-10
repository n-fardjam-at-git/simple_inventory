"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DockedPanel } from "@/components/filter/DockedPanel";
import { DismissNote } from "@/components/DismissNote";
import { FitList } from "@/components/list/FitList";
import { SelectableRow } from "@/components/list/ListTable";
import { WorkingBeside } from "@/components/WorkingBeside";
import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { CuttingDropQtyGrid } from "../cutting-orders/CuttingDropQtyGrid";
import { removeRequestProduct, saveRequestQty } from "./actions";
import type { RequestLine } from "./types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function RequestProductsPanel({
  open,
  onClose,
  requestId,
  requestNo,
  lines,
  draft,
}: {
  open: boolean;
  onClose: () => void;
  requestId: string | null;
  requestNo: number | null;
  lines: RequestLine[];
  draft: boolean;
}) {
  return (
    <DockedPanel
      open={open}
      onClose={onClose}
      title={requestNo != null ? `Order ${requestNo}` : "Order"}
      side="right"
      width="95%"
    >
      {open && requestId ? (
        <FitList
          items={lines}
          getKey={(line) => line.product_id}
          stretch
          tableClassName="inventory-boards table-fixed"
          thead={
            <thead>
              <tr className="text-stone-500">
                <th className="w-[16%] py-1">Product</th>
                <th className="py-1"></th>
                <th className="w-24 py-1"></th>
              </tr>
            </thead>
          }
          renderRow={(line) => <ProductRow line={line} draft={draft} />}
        />
      ) : null}
    </DockedPanel>
  );
}

function ProductRow({ line, draft }: { line: RequestLine; draft: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const busy = useRef(false);

  function persist() {
    if (busy.current) return;
    const form = formRef.current;
    if (!form) return;
    busy.current = true;
    setSaving(true);
    void (async () => {
      try {
        const message = await saveRequestQty(line.request_id, line.product_id, new FormData(form));
        if (message) {
          setErr(message);
          return;
        }
        setErr(null);
        setDirty(false);
        router.refresh();
      } finally {
        busy.current = false;
        setSaving(false);
      }
    })();
  }

  return (
    <SelectableRow id={line.product_id}>
      <td className="w-[16%] min-w-0 pr-2">
        <div className="font-medium leading-tight">{line.name}</div>
        <p className="text-xs font-light text-stone-500">${Number(line.price).toFixed(2)}</p>
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      <td className="min-w-0 pr-1">
        {draft ? (
          <form
            ref={formRef}
            onInput={() => setDirty(true)}
            onSubmit={(event) => {
              event.preventDefault();
              persist();
            }}
          >
            <CuttingDropQtyGrid
              sizes={line.sizes}
              drops={line.drops}
              cells={line.cells}
              editable
              qtyOnly
              namePrefix="qty"
              linePrice={line.price}
              onDirty={() => setDirty(true)}
            />
          </form>
        ) : (
          <CuttingDropQtyGrid
            qtyOnly
            sizes={line.sizes}
            drops={line.drops}
            cells={line.cells}
            linePrice={line.price}
          />
        )}
      </td>
      <td className="w-24 pr-2 align-top">
        {draft ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
            {dirty || saving ? (
              <span className="relative">
                <button
                  type="button"
                  className="text-xs font-medium text-teal-800 underline"
                  onClick={() => {
                    if (!saving) persist();
                  }}
                >
                  Save
                </button>
                {saving ? <WorkingBeside side="left" /> : null}
              </span>
            ) : null}
            <span className="relative">
              <button
                type="button"
                className="text-xs text-red-700 underline"
                onClick={() => {
                  if (deleting) return;
                  if (!confirm(`Remove ${line.name}?`)) return;
                  startDelete(async () => {
                    const message = await removeRequestProduct(line.request_id, line.product_id);
                    if (message) setErr(message);
                    else router.refresh();
                  });
                }}
              >
                Delete
              </button>
              {deleting ? <WorkingBeside side="left" /> : null}
            </span>
          </div>
        ) : (
          <span className="text-xs tabular-nums">{usd.format(line.price)}</span>
        )}
      </td>
    </SelectableRow>
  );
}
