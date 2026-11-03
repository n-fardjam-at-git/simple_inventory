"use client";

import { useState } from "react";
import { FitPage } from "@/components/list/FitList";
import type { SeasonRow } from "@/lib/season";
import { CustomerOrdersTable, type CustomerOrderRow } from "./CustomerOrdersTable";
import { NewOrderForm } from "./NewOrderForm";
import {
  OrderProductsPanel,
  type CatalogChoice,
  type ChargeChoice,
  type OrderProductLine,
  type SetItem,
} from "./OrderProductsPanel";

type Customer = { id: string; account_no: number; company_name: string; account_number: string | null };
type Address = {
  id: string;
  customer_id: string;
  address_type: string;
  location_name: string | null;
  city: string | null;
  address_line1: string | null;
};
type ShipmentMethod = { id: string; shipper: string | null; method: string };
type TransmissionMethod = { id: string; name: string };

export function CustomerOrdersWorkspace({
  rows,
  customers,
  addresses,
  shipmentMethods,
  transmissionMethods,
  seasons,
  lines,
  setItems,
  catalog,
  charges,
}: {
  rows: CustomerOrderRow[];
  customers: Customer[];
  addresses: Address[];
  shipmentMethods: ShipmentMethod[];
  transmissionMethods: TransmissionMethod[];
  seasons: SeasonRow[];
  lines: OrderProductLine[];
  setItems: SetItem[];
  catalog: CatalogChoice[];
  charges: ChargeChoice[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const order = rows.find((row) => row.id === openId) ?? null;

  return (
    <>
      <FitPage>
        <NewOrderForm
          customers={customers}
          addresses={addresses}
          shipmentMethods={shipmentMethods}
          transmissionMethods={transmissionMethods}
          seasons={seasons}
        />
        <CustomerOrdersTable rows={rows} customers={customers} onOpen={setOpenId} />
      </FitPage>
      <OrderProductsPanel
        open={openId != null}
        onClose={() => setOpenId(null)}
        orderId={openId}
        orderNo={order?.order_no ?? null}
        lines={lines.filter((line) => line.customer_order_id === openId)}
        setItems={setItems}
        catalog={catalog}
        charges={charges}
      />
    </>
  );
}
