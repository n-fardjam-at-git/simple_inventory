"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { DismissNote } from "@/components/DismissNote";
import { AvailableSizesMatrix } from "@/components/AvailableSizesMatrix";
import { loadAvailableSizes, type AvailableSizes } from "../shop/actions";
import { NextCuttingFold } from "../shop/NextCuttingFold";

const WIDTH = 760;
const GAP = 16;

/** Available sizes in the place of the inventory window: under the row, one at a time. */
export function RequestSizesWindow({
  productId,
  label,
  anchor,
  onClose,
}: {
  productId: string;
  label: string;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<AvailableSizes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; room?: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setErr(null);
    void loadAvailableSizes(productId).then((result) => {
      if (!live) return;
      if (typeof result === "string") setErr(result);
      else setData(result);
    });
    return () => {
      live = false;
    };
  }, [productId]);

  function clamp(left: number, top: number) {
    const box = boxRef.current;
    const width = box?.offsetWidth ?? WIDTH;
    const height = box?.offsetHeight ?? 0;
    return {
      left: Math.max(0, Math.min(left, window.innerWidth - width)),
      top: Math.max(0, Math.min(top, window.innerHeight - Math.min(height, 48))),
    };
  }

  function dragStart(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function dragMove(event: PointerEvent<HTMLDivElement>) {
    const held = drag.current;
    if (!held) return;
    moved.current = true;
    setPos(clamp(event.clientX - held.dx, event.clientY - held.dy));
  }

  function dragEnd(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  useLayoutEffect(() => {
    if (!anchor || moved.current) return;
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

  return createPortal(
    <div
      ref={boxRef}
      role="dialog"
      aria-label={`Available sizes ${label}`}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
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
          <span className="font-medium">Available sizes</span>
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
            <p className="flex items-center gap-2 text-xs text-stone-600">
              <span className="inline-block h-4 w-4 rounded-sm bg-green-600" aria-hidden />
              Available sizes
            </p>
            <AvailableSizesMatrix
              sizes={data.sizes}
              drops={data.drops}
              cells={data.cells}
              upcharges={data.upcharges}
            />
            <NextCuttingFold productId={productId} sizes={data.sizes} drops={data.drops} />
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
