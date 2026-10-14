"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ComboBox, reportInvalidCombo } from "@/components/ComboBox";
import { Btn } from "@/components/ui";
import { DockedPanel } from "@/components/filter/DockedPanel";
import type { CuttingOrderRow } from "./CuttingOrdersTable";
import {
  CuttingOrderProductsTable,
  type CuttingOrderProductRow,
} from "./CuttingOrderProductsTable";
import { addCuttingOrderProduct } from "./actions";

export type SetItem = { id: string; name: string };

export type CatalogProduct = {
  id: string;
  item_id: string | null;
  label: string;
};

export function OrderDetailsPanel({
  open,
  onClose,
  order,
  setItems,
  productLines,
  catalogProducts,
}: {
  open: boolean;
  onClose: () => void;
  order: CuttingOrderRow | null;
  setItems: SetItem[];
  productLines: CuttingOrderProductRow[];
  catalogProducts: CatalogProduct[];
}) {
  const [pickItemId, setPickItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setPickItemId(null);
  }, [open]);

  return (
    <DockedPanel
      open={open}
      onClose={onClose}
      title={order ? String(order.order_num) : "Order"}
      side="right"
      width="70%"
    >
      {setItems.length ? (
        <div className="mb-3 flex max-w-full shrink-0 flex-wrap rounded border border-stone-300 bg-white">
          {setItems.map((item, i) => (
            <ItemPickButton
              key={item.id}
              item={item}
              first={i === 0}
              open={pickItemId === item.id}
              orderId={order?.id ?? null}
              options={catalogProducts.filter((p) => p.item_id === item.id)}
              onToggle={() => setPickItemId((cur) => (cur === item.id ? null : item.id))}
              onClose={() => setPickItemId(null)}
            />
          ))}
        </div>
      ) : null}
      {open && order ? <CuttingOrderProductsTable rows={productLines} /> : null}
    </DockedPanel>
  );
}

function ItemPickButton({
  item,
  first,
  open,
  orderId,
  options,
  onToggle,
  onClose,
}: {
  item: SetItem;
  first: boolean;
  open: boolean;
  orderId: string | null;
  options: CatalogProduct[];
  onToggle: () => void;
  onClose: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setProductId("");
      setErr(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  function add() {
    if (!orderId) return;
    if (reportInvalidCombo(popRef.current)) return;
    if (!productId) {
      setErr("Pick a product.");
      return;
    }
    start(async () => {
      const message = await addCuttingOrderProduct(orderId, productId);
      if (message) {
        setErr(message);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={`px-2.5 py-1.5 text-sm leading-none ${
          first ? "" : "border-l border-stone-300"
        } ${open ? "bg-stone-900 text-white" : "text-stone-800 hover:bg-stone-50"}`}
        onClick={onToggle}
      >
        {item.name}
      </button>
      {open ? (
        <div
          ref={popRef}
          className="absolute top-full left-0 z-20 mt-1 w-72 rounded-lg border border-stone-200 bg-white p-3 shadow-lg"
        >
          <label className="mb-2 block text-sm">
            <span className="mb-1 block text-stone-500">Product</span>
            <ComboBox
              key={item.id}
              required
              className="w-full rounded border px-2 py-1"
              placeholder="Product"
              value={productId}
              onChange={(id) => {
                setProductId(id);
                setErr(null);
              }}
              options={options.map((p) => ({ id: p.id, label: p.label }))}
            />
          </label>
          {err ? <p className="mb-2 text-xs text-red-700">{err}</p> : null}
          {pending ? <p className="mb-2 text-xs text-stone-400">Working…</p> : null}
          <div className="flex gap-2">
            <Btn type="button" disabled={pending} onClick={add}>
              Add
            </Btn>
            <button
              type="button"
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
