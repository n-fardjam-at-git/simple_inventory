"use client";

import { FitList } from "@/components/list/FitList";
import { InventoryMatrixCard, type InventoryBoard } from "./InventoryMatrixCard";

export function InventoryList({
  boards,
  canEdit,
  focusId = null,
  focusNonce = 0,
}: {
  boards: InventoryBoard[];
  canEdit: boolean;
  focusId?: string | null;
  focusNonce?: number;
}) {
  return (
    <FitList
      items={boards}
      getKey={(b) => b.productId}
      tableClassName="inventory-boards"
      focusId={focusId}
      focusNonce={focusNonce}
      renderRow={(b) => <InventoryMatrixCard {...b} canEdit={canEdit} />}
    />
  );
}
