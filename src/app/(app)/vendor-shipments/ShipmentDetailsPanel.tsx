"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ComboBox } from "@/components/ComboBox";
import { Btn } from "@/components/ui";
import { DockedPanel } from "@/components/filter/DockedPanel";
import type { VendorShipmentRow } from "./VendorShipmentsTable";
import { CuttingViewTable } from "./CuttingViewTable";
import { AddShipmentProductsPopup } from "./AddShipmentProductsPopup";
import { cuttingOrderLabel } from "@/lib/cutting-order";
import type { CatalogCutting, CatalogCuttingProduct, CuttingViewRow } from "./types";

export type { CatalogCutting, CatalogCuttingProduct };

export function ShipmentDetailsPanel({
  open,
  onClose,
  shipment,
  lines,
  catalogCuttings,
  catalogProducts,
}: {
  open: boolean;
  onClose: () => void;
  shipment: VendorShipmentRow | null;
  lines: CuttingViewRow[];
  catalogCuttings: CatalogCutting[];
  catalogProducts: CatalogCuttingProduct[];
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
    const rows = shipment ? lines.filter((l) => l.shipment_id === shipment.id) : [];
    return [...rows].sort((a, b) => {
      if (b.order_num !== a.order_num) return b.order_num - a.order_num;
      return a.product_label.localeCompare(b.product_label, "en", { sensitivity: "base" });
    });
  }, [lines, shipment]);

  useEffect(() => {
    if (!open || !shipment) {
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
  }, [open, shipment?.id, viewRows, pendingSelect]);

  const posted = shipment?.posted ?? false;
  const openCuttings = catalogCuttings.filter(
    (c) => c.status && (!shipment?.vendor_id || c.vendor_id === shipment.vendor_id),
  );
  const unusedProducts = catalogProducts.filter(
    (p) =>
      p.status &&
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
      title={shipment ? String(shipment.shipment_num) : "Shipment"}
      subtitle={shipment?.vendors?.name ?? undefined}
      side="right"
      width="95%"
    >
      {open && shipment ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <CuttingViewTable
            key={shipment.id}
            rows={viewRows}
            posted={posted}
            resumeId={resumeId}
          />
          {posted ? null : (
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
              <Btn
                type="button"
                disabled={!pickCutting}
                onClick={() => setPickerOpen(true)}
              >
                Add
              </Btn>
            </div>
          )}
          <AddShipmentProductsPopup
            open={pickerOpen && Boolean(pickCutting)}
            shipmentId={shipment.id}
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
