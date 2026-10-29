"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ComboBox } from "@/components/ComboBox";
import { Btn } from "@/components/ui";
import { DockedPanel } from "@/components/filter/DockedPanel";
import { cuttingOrderLabel } from "@/lib/cutting-order";
import { AdviceLinesTable } from "./AdviceLinesTable";
import { AddAdviceProductsPopup } from "./AddAdviceProductsPopup";
import type { AdviceRow } from "./VendorAdvicesTable";
import type { AdviceCutting, AdviceCuttingProduct, AdviceLine } from "./types";

export function AdviceDetailsPanel({
  open,
  onClose,
  advice,
  lines,
  cuttings,
  products,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  advice: AdviceRow | null;
  lines: AdviceLine[];
  cuttings: AdviceCutting[];
  products: AdviceCuttingProduct[];
  canEdit: boolean;
}) {
  const [pendingSelect, setPendingSelect] = useState<{
    cutting_order_id: string;
    product_id: string;
  } | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [pickCutting, setPickCutting] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const router = useRouter();

  const viewRows = useMemo(() => {
    const rows = advice ? lines.filter((l) => l.advice_id === advice.id) : [];
    return [...rows].sort((a, b) => {
      if (b.order_num !== a.order_num) return b.order_num - a.order_num;
      return a.product_label.localeCompare(b.product_label, "en", { sensitivity: "base" });
    });
  }, [lines, advice]);

  useEffect(() => {
    if (!open || !advice) {
      setPickCutting("");
      setPendingSelect(null);
      setResumeId(null);
      setPickerOpen(false);
      return;
    }
    if (!pendingSelect) return;
    const found = viewRows.find(
      (r) =>
        r.cutting_order_id === pendingSelect.cutting_order_id &&
        r.product_id === pendingSelect.product_id,
    );
    if (found) {
      setResumeId(found.id);
      setPendingSelect(null);
    }
  }, [open, advice?.id, viewRows, pendingSelect]);

  const locked = !canEdit || advice?.status !== "draft";
  const openCuttings = cuttings.filter(
    (c) => c.status && (!advice?.vendor_id || c.vendor_id === advice.vendor_id),
  );
  const unusedProducts = products.filter(
    (p) =>
      p.cutting_order_id === pickCutting &&
      !viewRows.some(
        (r) => r.cutting_order_id === p.cutting_order_id && r.product_id === p.product_id,
      ),
  );
  const pickNo = openCuttings.find((c) => c.id === pickCutting)?.order_num ?? null;

  return (
    <DockedPanel
      open={open}
      onClose={onClose}
      title={advice ? String(advice.advice_num) : "Packing list"}
      subtitle={advice?.vendor_name ?? undefined}
      side="right"
      width="95%"
    >
      {open && advice ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <AdviceLinesTable key={advice.id} rows={viewRows} locked={locked} resumeId={resumeId} />
          {locked ? null : (
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
              <ComboBox
                required
                placeholder="Cutting"
                className="min-w-0 rounded border px-2 py-1"
                value={pickCutting}
                onChange={(id) => {
                  setPickCutting(id);
                  setPickerOpen(false);
                }}
                options={openCuttings.map((c) => ({
                  id: c.id,
                  label: cuttingOrderLabel(c.order_num),
                }))}
              />
              <Btn type="button" disabled={!pickCutting} onClick={() => setPickerOpen(true)}>
                Add
              </Btn>
            </div>
          )}
          <AddAdviceProductsPopup
            open={pickerOpen && Boolean(pickCutting)}
            adviceId={advice.id}
            cuttingOrderId={pickCutting}
            cuttingNo={pickNo}
            products={unusedProducts}
            onAdded={(ids) => {
              setPickerOpen(false);
              const last = ids[ids.length - 1];
              if (last) setPendingSelect({ cutting_order_id: pickCutting, product_id: last });
              router.refresh();
            }}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      ) : null}
    </DockedPanel>
  );
}
