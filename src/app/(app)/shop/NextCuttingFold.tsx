"use client";

import { useEffect, useState } from "react";
import { DismissNote } from "@/components/DismissNote";
import { AvailableSizesMatrix } from "@/components/AvailableSizesMatrix";
import type { MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { loadShopNextCutting, type ShopNextCutting } from "./actions";

function usDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${month}/${day}/${year}`;
}

/** Coming cutting, folded until the customer opens it. */
export function NextCuttingFold({
  productId,
  sizes,
  drops,
}: {
  productId: string;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
}) {
  const [arrival, setArrival] = useState<ShopNextCutting | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setOpen(false);
    setArrival(null);
    setErr(null);
    loadShopNextCutting(productId).then((result) => {
      if (cancel) return;
      if (typeof result === "string") setErr(result);
      else setArrival(result);
    });
    return () => {
      cancel = true;
    };
  }, [productId]);

  if (err) {
    return (
      <DismissNote className="text-xs text-red-700" onDismiss={() => setErr(null)}>
        {err}
      </DismissNote>
    );
  }
  if (!arrival) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-2 text-xs font-medium text-stone-700"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden className="inline-block w-3 text-center text-stone-500">
          {open ? "v" : ">"}
        </span>
        Next arrives {usDate(arrival.arrives)}
      </button>
      {open ? (
        <AvailableSizesMatrix sizes={sizes} drops={drops} cells={arrival.cells} upcharges={[]} />
      ) : null}
    </div>
  );
}
