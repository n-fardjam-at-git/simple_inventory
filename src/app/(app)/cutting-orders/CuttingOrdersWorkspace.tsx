"use client";

import { useState } from "react";
import { Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";
import { createCuttingOrder } from "./actions";
import { CuttingOrdersTable, type CuttingOrderRow } from "./CuttingOrdersTable";
import { OrderDetailsPanel, type CatalogProduct, type SetItem } from "./OrderDetailsPanel";
import type { CuttingOrderProductRow } from "./CuttingOrderProductsTable";

type Vendor = { id: string; name: string; is_active?: boolean };

export function CuttingOrdersWorkspace({
  rows,
  vendors,
  setItems,
  productLines,
  catalogProducts,
}: {
  rows: CuttingOrderRow[];
  vendors: Vendor[];
  setItems: SetItem[];
  productLines: CuttingOrderProductRow[];
  catalogProducts: CatalogProduct[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = rows.find((r) => r.id === openId) ?? null;
  const openLines = productLines.filter((l) => l.cutting_order_id === openId);

  return (
    <>
      <FitPage>
        <CuttingOrdersTable
          rows={rows}
          vendors={vendors}
          onOpen={(id) => setOpenId(id)}
        />
        <AddForm action={createCuttingOrder} className="flex shrink-0 flex-wrap gap-2 text-sm">
          <ComboBox
            name="vendor_id"
            required
            placeholder="Vendor"
            options={vendors.filter((v) => v.is_active).map((v) => ({ id: v.id, label: v.name }))}
          />
          <input name="arrival_date" type="date" required className="rounded border px-2 py-1" />
          <input name="reference" placeholder="PO No" className="rounded border px-2 py-1" />
          <Btn type="submit">Add</Btn>
        </AddForm>
      </FitPage>
      <OrderDetailsPanel
        open={openId != null}
        onClose={() => setOpenId(null)}
        order={openRow}
        setItems={setItems}
        productLines={openLines}
        catalogProducts={catalogProducts}
      />
    </>
  );
}
