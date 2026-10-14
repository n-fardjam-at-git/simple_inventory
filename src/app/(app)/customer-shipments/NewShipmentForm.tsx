"use client";

import { Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { createShipment } from "./actions";
import { useMemo, useState } from "react";

export function NewShipmentForm({
  customers,
  addresses,
}: {
  customers: { id: string; company_name: string; account_number: string | null }[];
  addresses: { id: string; customer_id: string; address_type: string; label: string | null; city: string | null }[];
}) {
  const [customerId, setCustomerId] = useState("");
  const addrOpts = useMemo(
    () =>
      addresses
        .filter((a) => a.customer_id === customerId)
        .map((a) => ({
          id: a.id,
          label: `${a.label ?? a.address_type} · ${a.city ?? ""}`.trim(),
        })),
    [addresses, customerId],
  );

  return (
    <form action={createShipment} className="flex flex-wrap gap-2 text-sm">
      <ComboBox
        name="customer_id"
        required
        placeholder="Customer"
        value={customerId}
        onChange={setCustomerId}
        options={customers.map((c) => ({
          id: c.id,
          label: c.account_number ? `${c.company_name} (${c.account_number})` : c.company_name,
        }))}
      />
      <ComboBox
        key={customerId || "none"}
        name="customer_address_id"
        allowEmpty
        placeholder="Ship-to"
        options={addrOpts}
      />
      <input name="shipping_date" type="date" required className="rounded border px-2 py-1" />
      <Btn type="submit">Create</Btn>
    </form>
  );
}
