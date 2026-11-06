"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { DismissNote } from "@/components/DismissNote";
import type { MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { CuttingDropQtyGrid } from "../cutting-orders/CuttingDropQtyGrid";
import { loadProductInventory, type ProductInventory } from "./actions";

const WIDTH = 760;
/** Space kept between the row and the window. */
const GAP = 16;

function usDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/**
 * Non-modal popup: what is on hand for one product, and when the next cutting arrives.
 * No overlay, so the panel behind stays usable. The row that opened it closes it.
 */
export function ProductInventoryPopup({
  productId,
  label,
  sizes,
  drops,
  anchor,
  onClose,
}: {
  productId: string;
  label: string;
  /** Omit for a product that is not on the order. The loader supplies them. */
  sizes?: MatrixSize[];
  drops?: MatrixDrop[];
  /** The product row, or the picker bar. The popup opens just above or below it. */
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<ProductInventory | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; room?: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void loadProductInventory(productId).then((result) => {
      if (!live) return;
      if (typeof result === "string") setErr(result);
      else setData(result);
    });
    return () => {
      live = false;
    };
  }, [productId]);

  // Once the user drags the window, stop placing it beside the button.
  const moved = useRef(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  function clamp(left: number, top: number) {
    const box = boxRef.current;
    const width = box?.offsetWidth ?? WIDTH;
    const height = box?.offsetHeight ?? 0;
    return {
      left: Math.max(0, Math.min(left, window.innerWidth - width)),
      top: Math.max(0, Math.min(top, window.innerHeight - Math.min(height, 48))),
      room: undefined,
    };
  }

  function dragStart(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function dragMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    moved.current = true;
    setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  }

  function dragEnd(e: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  useLayoutEffect(() => {
    if (!anchor || moved.current) return;
    // Sit above or below the row, never over it, so the row can be edited without moving the window.
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - 16);
    const full = boxRef.current?.scrollHeight ?? 0;
    const below = window.innerHeight - rect.bottom - GAP - 8;
    const above = rect.top - GAP - 8;
    const useBelow = full <= below || (full > above && below >= above);
    const room = Math.max(120, useBelow ? below : above);
    const height = Math.min(full, room);
    const top = useBelow ? rect.bottom + GAP : rect.top - GAP - height;
    const left = Math.max(8, Math.min(rect.left + 8, window.innerWidth - width - 8));
    setPos({ left, top: Math.max(8, top), room });
  }, [anchor, data, err]);

  if (typeof document === "undefined") return null;

  const onHand = data?.cells.reduce((sum, cell) => sum + cell.qty, 0) ?? 0;

  return createPortal(
    <div
      ref={boxRef}
      role="dialog"
      aria-label={`Inventory ${label}`}
      // A portal still bubbles React events to the row. Keep clicks here from selecting or deselecting it.
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="fixed z-[85] max-h-[calc(100vh-1rem)] w-[min(760px,calc(100vw-1rem))] overflow-auto rounded-lg border border-stone-300 bg-white shadow-lg"
      style={{
        left: pos?.left ?? 8,
        top: pos?.top ?? 8,
        maxHeight: pos?.room,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div
        className="flex cursor-move touch-none select-none items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2"
        title="Drag to move"
        onPointerDown={dragStart}
        onPointerMove={dragMove}
        onPointerUp={dragEnd}
        onPointerCancel={dragEnd}
      >
        <p className="min-w-0 truncate text-sm text-stone-800">
          <span className="font-medium">Inventory</span>
          <span className="font-light text-stone-500"> • {label}</span>
        </p>
        <button
          type="button"
          className="cursor-pointer rounded px-1.5 py-0.5 text-lg leading-none text-stone-500 hover:bg-stone-100"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="space-y-3 p-3">
        {err ? (
          <DismissNote className="text-xs text-red-700" onDismiss={() => setErr(null)}>
            {err}
          </DismissNote>
        ) : null}
        {!data && !err ? <p className="text-xs text-stone-500">Loading…</p> : null}
        {data ? (
          <>
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-medium text-stone-700">Arrives next</span>
              <span className="tabular-nums text-stone-900">
                {data.arrives_next ? usDate(data.arrives_next) : "—"}
              </span>
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="font-medium text-stone-700">On hand</span>
                <span className="tabular-nums text-stone-500">Total {onHand}</span>
              </div>
              {onHand > 0 ? (
                <CuttingDropQtyGrid
                  qtyOnly
                  sizes={sizes ?? data.sizes}
                  drops={drops ?? data.drops}
                  cells={data.cells.filter((cell) => cell.qty > 0)}
                />
              ) : (
                <p className="text-xs text-stone-500">None on hand.</p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
