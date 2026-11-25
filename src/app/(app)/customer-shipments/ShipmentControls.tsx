"use client";

import { useEffect, useState } from "react";
import { Btn } from "@/components/ui";
import { SHIPMENT_OPEN_STATUS, shipmentStatusLabel } from "@/lib/customer-shipment";
import { setShipmentStatus, shipShipment } from "./actions";

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Moves between the open statuses, or cancels. A canceled shipment stays canceled. */
export function StatusForm({ shipmentId, status }: { shipmentId: string; status: string }) {
  return (
    <form
      action={setShipmentStatus.bind(null, shipmentId)}
      className="flex items-end gap-2 text-sm"
      onSubmit={(event) => {
        const picked = new FormData(event.currentTarget).get("status");
        if (picked !== "canceled") return;
        if (!confirm("Cancel this shipment? It cannot be reopened.")) event.preventDefault();
      }}
    >
      <label>
        <span className="mb-1 block text-xs text-stone-500">Status</span>
        <select name="status" defaultValue={status} className="rounded border px-2 py-1">
          {SHIPMENT_OPEN_STATUS.map((value) => (
            <option key={value} value={value}>
              {shipmentStatusLabel(value)}
            </option>
          ))}
          <option value="canceled">{shipmentStatusLabel("canceled")}</option>
        </select>
      </label>
      <Btn type="submit">Set status</Btn>
    </form>
  );
}

/** Ship is one step and is not undone, so it asks first. */
export function ShipForm({ shipmentId }: { shipmentId: string }) {
  const [date, setDate] = useState("");
  useEffect(() => setDate(todayIso()), []);

  return (
    <form
      action={shipShipment.bind(null, shipmentId)}
      className="flex items-end gap-2 text-sm"
      onSubmit={(event) => {
        if (!confirm("Ship this shipment? Stock comes off inventory and the shipment is locked.")) {
          event.preventDefault();
        }
      }}
    >
      <label>
        <span className="mb-1 block text-xs text-stone-500">Date shipped</span>
        <input
          type="date"
          name="date_shipped"
          required
          className="rounded border px-2 py-1"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <Btn type="submit">Ship</Btn>
    </form>
  );
}
