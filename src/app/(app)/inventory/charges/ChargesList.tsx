"use client";

import { ListTable, SelectableRow } from "@/components/list/ListTable";
import { productTypeLabel } from "@/lib/product-type";

type Row = {
  id: string;
  type: number;
  name: string | null;
  standard_price: number;
  is_active: boolean;
};

export function ChargesList({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-300 bg-white p-3">
      <ListTable>
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Type</th>
            <th>Product</th>
            <th>Line price</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <SelectableRow key={r.id} id={r.id} dimmed={!r.is_active}>
              <td className="py-1">{productTypeLabel(r.type)}</td>
              <td className="font-medium">{r.name ?? productTypeLabel(r.type)}</td>
              <td>${Number(r.standard_price).toFixed(2)}</td>
              <td>{r.is_active ? "Active" : "Inactive"}</td>
            </SelectableRow>
          ))}
        </tbody>
      </ListTable>
    </div>
  );
}
