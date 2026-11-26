"use client";

import { useState } from "react";
import { FitPage } from "@/components/list/FitList";
import { PageTitle } from "@/components/ui";
import {
  CustomerShipmentsTable,
  type CustomerShipmentRow,
  type ShipmentPicker,
} from "./CustomerShipmentsTable";
import { NewShipmentForm, type ShipmentCustomer } from "./NewShipmentForm";
import {
  ShipmentProductsPanel,
  type ShipmentChargeChoice,
  type ShipmentLine,
  type ShipmentOrderChoice,
} from "./ShipmentProductsPanel";

export function CustomerShipmentsWorkspace({
  rows,
  lines,
  focusId = null,
  canWrite,
  customers,
  pickers,
  orders,
  charges,
}: {
  rows: CustomerShipmentRow[];
  lines: ShipmentLine[];
  /** The shipment to select when the page opens (from the pick list). */
  focusId?: string | null;
  /** Admin and warehouse. A sales rep only reads. */
  canWrite: boolean;
  customers: ShipmentCustomer[];
  pickers: ShipmentPicker[];
  orders: ShipmentOrderChoice[];
  charges: ShipmentChargeChoice[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const shipment = rows.find((row) => row.id === openId) ?? null;

  return (
    <>
      <FitPage>
        <PageTitle title="Customer shipments" />
        {canWrite ? <NewShipmentForm customers={customers} /> : null}
        <CustomerShipmentsTable
          rows={rows}
          lines={lines}
          focusId={focusId}
          canWrite={canWrite}
          pickers={pickers}
          onOpen={setOpenId}
        />
      </FitPage>
      <ShipmentProductsPanel
        open={shipment != null}
        onClose={() => setOpenId(null)}
        shipment={shipment}
        lines={lines.filter((line) => line.customer_shipment_id === openId)}
        canWrite={canWrite}
        orders={orders}
        charges={charges}
      />
    </>
  );
}
