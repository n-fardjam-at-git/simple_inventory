"use client";

import { DismissNote } from "@/components/DismissNote";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { useRefreshRow } from "@/components/list/useRefreshRow";
import { FitList } from "@/components/list/FitList";
import { CuttingDropQtyGrid } from "@/app/(app)/cutting-orders/CuttingDropQtyGrid";
import { deleteVendorShipmentProduct, saveVendorShipmentLine } from "./actions";
import type { CuttingViewRow } from "./types";

export function CuttingViewTable({
  rows,
  posted,
  resumeId = null,
}: {
  rows: CuttingViewRow[];
  posted: boolean;
  resumeId?: string | null;
}) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      resumeId={resumeId}
      tableClassName="inventory-boards table-fixed"
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="w-20 py-1">Cutting</th>
            <th className="w-52 py-1">Product</th>
            <th className="w-full py-1"></th>
            <th className="w-24 py-1"></th>
          </tr>
        </thead>
      }
      renderRow={(r) => <ViewRow row={r} posted={posted} />}
    />
  );
}

function ViewRow({ row, posted }: { row: CuttingViewRow; posted: boolean }) {
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const list = useList();
  const router = useRouter();
  const refreshRow = useRefreshRow(row);
  const id = row.id;
  const dirty = matrixDirty;

  function persist() {
    return new Promise<boolean>((resolve) => {
      if (busy.current) {
        resolve(false);
        return;
      }
      const form = formRef.current;
      const formData = form ? new FormData(form) : new FormData();
      busy.current = true;
      setSaving(true);
      void (async () => {
        try {
          const message = await saveVendorShipmentLine(row.id, formData);
          if (message) {
            setErr(message);
            resolve(false);
            return;
          }
          setErr(null);
          await refreshRow();
          setMatrixDirty(false);
          list.finishEdit(id);
          resolve(true);
        } finally {
          busy.current = false;
          setSaving(false);
        }
      })();
    });
  }

  const { editing, requestEdit, requestCancel } = useListRow(id, {
    dirty,
    revert: () => {
      setMatrixDirty(false);
      setFormKey((k) => k + 1);
      setErr(null);
    },
    save: persist,
  });

  return (
    <SelectableRow id={id}>
      <td className="w-20 py-1.5 pr-2 tabular-nums">{row.order_num}</td>
      <td className="w-52 pr-2">
        <div className="font-medium leading-tight">{row.product_label}</div>
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      <td className="w-full min-w-0 pr-1">
        {editing && !posted ? (
          <form
            key={formKey}
            ref={formRef}
            className="min-w-0 w-full"
            onInput={() => setMatrixDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              void persist();
            }}
          >
            <CuttingDropQtyGrid
              sizes={row.sizes}
              drops={row.drops}
              cells={row.cells}
              editable
              namePrefix="shp"
              onDirty={() => setMatrixDirty(true)}
            />
          </form>
        ) : (
          <CuttingDropQtyGrid sizes={row.sizes} drops={row.drops} cells={row.cells} />
        )}
      </td>
      <td className="w-24 whitespace-nowrap py-1 pr-2">
        {posted ? null : (
          <RowButtons
            editing={editing}
            dirty={dirty}
            saving={saving}
            deleting={pending}
            onEdit={requestEdit}
            onSave={() => void persist()}
            onCancel={requestCancel}
            onDelete={
              editing
                ? undefined
                : () => {
                    if (!confirm(`Remove ${row.product_label} from cutting ${row.order_num}?`)) {
                      return;
                    }
                    start(async () => {
                      const message = await deleteVendorShipmentProduct(row.id);
                      if (message) setErr(message);
                      else router.refresh();
                    });
                  }
            }
          />
        )}
      </td>
    </SelectableRow>
  );
}
