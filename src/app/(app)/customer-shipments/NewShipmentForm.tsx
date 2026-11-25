"use client";

import { Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { customerPickLabel } from "@/lib/customer";
import { createShipment } from "./actions";

export function NewShipmentForm({
  customers,
}: {
  customers: { id: string; account_no: number; company_name: string; account_number: string | null }[];
}) {
  return (
    <form action={createShipment} className="flex flex-wrap gap-2 text-sm">
      <ComboBox
        name="customer_id"
        required
        placeholder="Customer"
        options={customers.map((customer) => ({
          id: customer.id,
          label: customerPickLabel(customer),
        }))}
      />
      <Btn type="submit">Create</Btn>
    </form>
  );
}
