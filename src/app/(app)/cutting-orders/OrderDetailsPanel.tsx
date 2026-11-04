"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { ComboBox, reportInvalidCombo } from "@/components/ComboBox";
import { Btn } from "@/components/ui";
import { DockedPanel } from "@/components/filter/DockedPanel";
import type { CuttingOrderRow } from "./CuttingOrdersTable";
import {
  CuttingOrderProductsTable,
  type CuttingOrderProductRow,
} from "./CuttingOrderProductsTable";
import {
  CuttingOrderLotsTable,
  type CuttingOrderLotRow,
} from "./CuttingOrderLotsTable";
import { AddForm } from "@/components/AddForm";
import { LotAddFields } from "@/app/(app)/lots/LotAddFields";
import { LookupCard } from "@/app/(app)/lots/LookupCard";
import { addCuttingOrderLot, addCuttingOrderProduct, createLotForOrder } from "./actions";
import { ScalePanel } from "./ScalePanel";
import { QtyCopyPopup, snapshotQtyCopy, type QtyCopy, type QtyCopyTarget } from "./QtyCopyPopup";
import { pasteSizedCells } from "./scale-actions";
import {
  NewOrderProductPopup,
  type CatalogModel,
  type ChartDim,
} from "./NewOrderProductPopup";
import type { SeasonRow } from "@/lib/season";

export type SetItem = { id: string; name: string };

function copyTarget(row: CuttingOrderProductRow | null): QtyCopyTarget | null {
  if (!row) return null;
  return {
    product_id: row.product_id,
    item_id: row.item_id,
    size_chart_id: row.size_chart_id,
    label: row.products?.models?.name?.trim() || row.products?.name?.trim() || "Product",
    cells: row.cells,
  };
}

export type CatalogProduct = {
  id: string;
  item_id: string | null;
  brand_id: string | null;
  lot_id: string | null;
  label: string;
};

export type CatalogLot = {
  id: string;
  lot_no: string;
  brand_id: string | null;
  is_active?: boolean;
  article?: string | null;
  color_num?: string | null;
  pattern_id?: string | null;
  content_id?: string | null;
};

export type LotLookup = { id: string; name: string; is_active: boolean };

export function OrderDetailsPanel({
  open,
  onClose,
  order,
  setItems,
  productLines,
  orderLots,
  catalogProducts,
  catalogLots,
  colors,
  patterns,
  contents,
  models,
  sizes,
  drops,
  seasons,
  collections,
}: {
  open: boolean;
  onClose: () => void;
  order: CuttingOrderRow | null;
  setItems: SetItem[];
  productLines: CuttingOrderProductRow[];
  orderLots: CuttingOrderLotRow[];
  catalogProducts: CatalogProduct[];
  catalogLots: CatalogLot[];
  colors: LotLookup[];
  patterns: LotLookup[];
  contents: LotLookup[];
  models: CatalogModel[];
  sizes: ChartDim[];
  drops: ChartDim[];
  seasons: SeasonRow[];
  collections: { id: string; name: string }[];
}) {
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [newLotOpen, setNewLotOpen] = useState(false);
  const [scaleProduct, setScaleProduct] = useState<CuttingOrderProductRow | null>(null);
  const [copyProduct, setCopyProduct] = useState<CuttingOrderProductRow | null>(null);
  const [copies, setCopies] = useState<QtyCopy[]>([]);
  const anyItem: SetItem = { id: "any", name: "Any" };
  const lotIds = orderLots.map((l) => l.lot_id).join(",");
  const sessionOrderId = useRef("");
  const prevLotIds = useRef("");

  useEffect(() => {
    if (!open || !order) {
      setPickItemId(null);
      setSelectedLotId(null);
      setNewLotOpen(false);
      setScaleProduct(null);
      setCopyProduct(null);
      setCopies([]);
      sessionOrderId.current = "";
      prevLotIds.current = "";
      return;
    }
    setPickItemId(null);
    const switched = sessionOrderId.current !== order.id;
    sessionOrderId.current = order.id;
    if (switched) {
      prevLotIds.current = lotIds;
      setSelectedLotId(orderLots[0]?.lot_id ?? null);
      setCopies([]);
      setCopyProduct(null);
      setScaleProduct(null);
      return;
    }
    const had = new Set(prevLotIds.current.split(",").filter(Boolean));
    const added = orderLots.map((l) => l.lot_id).filter((id) => !had.has(id));
    prevLotIds.current = lotIds;
    if (added.length) {
      setSelectedLotId(added[added.length - 1]);
      return;
    }
    setSelectedLotId((cur) =>
      cur && orderLots.some((l) => l.lot_id === cur) ? cur : (orderLots[0]?.lot_id ?? null),
    );
  }, [open, order?.id, lotIds]);

  const liveCopy = copyProduct
    ? (productLines.find(
        (l) =>
          l.cutting_order_id === copyProduct.cutting_order_id &&
          l.product_id === copyProduct.product_id,
      ) ?? copyProduct)
    : null;
  const lotLines = productLines.filter((l) => l.products?.lots?.id === selectedLotId);
  const unusedLots = catalogLots.filter(
    (l) =>
      l.brand_id === order?.brand_id &&
      l.is_active !== false &&
      !orderLots.some((on) => on.lot_id === l.id),
  );

  return (
    <>
    <DockedPanel
      open={open}
      onClose={onClose}
      title={order ? String(order.order_num) : "Order"}
      side="right"
      width="95%"
    >
      {open && order ? (
        <div className="flex min-h-0 flex-1 gap-2">
          <div className="flex min-h-0 w-56 min-w-0 shrink-0 flex-col gap-2">
            <CuttingOrderLotsTable
              rows={orderLots}
              selectId={selectedLotId}
              onSelect={setSelectedLotId}
            />
            <div className="relative shrink-0">
              <AddForm
                action={addCuttingOrderLot.bind(null, order.id)}
                className="flex flex-col gap-2 text-sm"
              >
                <div className="flex items-center gap-1">
                  <ComboBox
                    name="lot_id"
                    required
                    placeholder="Lot"
                    className="min-w-0 flex-1 rounded border px-2 py-1"
                    options={unusedLots.map((l) => ({ id: l.id, label: l.lot_no }))}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded border border-red-700 px-1.5 py-0.5 text-[11px] leading-none text-red-700"
                    onClick={() => setNewLotOpen((cur) => !cur)}
                  >
                    New
                  </button>
                </div>
                <Btn type="submit">Add lot</Btn>
              </AddForm>
              {newLotOpen ? (
                <NewLotPopup
                  orderId={order.id}
                  brandId={order.brand_id}
                  lots={catalogLots}
                  colors={colors}
                  patterns={patterns}
                  contents={contents}
                  onClose={() => setNewLotOpen(false)}
                />
              ) : null}
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {selectedLotId ? (
              <div className="mb-3 flex shrink-0 justify-center">
                <div className="min-w-56 max-w-full rounded-lg border border-stone-300 bg-white">
                  <div className="border-b border-stone-300 bg-stone-100 px-3 py-2 text-center text-sm font-medium text-stone-700">
                    Add a product
                  </div>
                  <div className="grid grid-flow-col auto-cols-fr">
                    {[anyItem, ...setItems.slice(0, 14)].map((item) => (
                      <ItemPickButton
                        key={item.id}
                        item={item}
                        open={pickItemId === item.id}
                        orderId={order.id}
                        lotId={selectedLotId}
                        models={models}
                        sizes={sizes}
                        drops={drops}
                        seasons={seasons}
                        collections={collections}
                        options={catalogProducts.filter(
                          (p) =>
                            p.lot_id === selectedLotId &&
                            p.brand_id === order.brand_id &&
                            (item.id === "any" || p.item_id === item.id),
                        )}
                        onToggle={() => setPickItemId((cur) => (cur === item.id ? null : item.id))}
                        onClose={() => setPickItemId(null)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mb-3 shrink-0 text-sm text-stone-500">Add a lot, then add products.</p>
            )}
            <CuttingOrderProductsTable
              key={selectedLotId ?? "products"}
              rows={lotLines}
              lotNo={orderLots.find((l) => l.lot_id === selectedLotId)?.lot_no}
              scaleId={
                scaleProduct
                  ? `${scaleProduct.cutting_order_id}:${scaleProduct.product_id}`
                  : null
              }
              copyId={
                copyProduct
                  ? `${copyProduct.cutting_order_id}:${copyProduct.product_id}`
                  : null
              }
              onScale={(row) => {
                setCopyProduct(null);
                setScaleProduct((cur) =>
                  cur &&
                  cur.cutting_order_id === row.cutting_order_id &&
                  cur.product_id === row.product_id
                    ? null
                    : row,
                );
              }}
              onCopy={(row) => {
                setScaleProduct(null);
                setCopyProduct((cur) =>
                  cur &&
                  cur.cutting_order_id === row.cutting_order_id &&
                  cur.product_id === row.product_id
                    ? null
                    : row,
                );
              }}
            />
          </div>
        </div>
      ) : null}
    </DockedPanel>
      <ScalePanel
        open={Boolean(open && scaleProduct)}
        product={
          scaleProduct
            ? (lotLines.find(
                (l) =>
                  l.cutting_order_id === scaleProduct.cutting_order_id &&
                  l.product_id === scaleProduct.product_id,
              ) ?? scaleProduct)
            : null
        }
        onClose={() => setScaleProduct(null)}
      />
      <QtyCopyPopup
        open={Boolean(open && copyProduct)}
        product={copyTarget(liveCopy)}
        copies={copies}
        onCopy={() => {
          if (!liveCopy) return;
          const snap = snapshotQtyCopy({
            item_id: liveCopy.item_id,
            size_chart_id: liveCopy.size_chart_id,
            itemName: liveCopy.products?.models?.items?.name?.trim() || "Item",
            sizes: liveCopy.sizes,
            drops: liveCopy.drops,
            cells: liveCopy.cells,
          });
          if (!snap) return;
          setCopies((cur) => [...cur, snap]);
        }}
        onPaste={(copy, mode) => {
          if (!liveCopy) return Promise.resolve("Open a product first.");
          return pasteSizedCells(
            liveCopy.cutting_order_id,
            liveCopy.product_id,
            copy.cells,
            copy.itemId,
            copy.sizeChartId,
            mode,
          );
        }}
        onClear={() => setCopies([])}
        onDelete={(id) => setCopies((cur) => cur.filter((c) => c.id !== id))}
        onClose={() => setCopyProduct(null)}
      />
    </>
  );
}

function ItemPickButton({
  item,
  open,
  orderId,
  lotId,
  options,
  models,
  sizes,
  drops,
  seasons,
  collections,
  onToggle,
  onClose,
}: {
  item: SetItem;
  open: boolean;
  orderId: string | null;
  lotId: string | null;
  options: CatalogProduct[];
  models: CatalogModel[];
  sizes: ChartDim[];
  drops: ChartDim[];
  seasons: SeasonRow[];
  collections: { id: string; name: string }[];
  onToggle: () => void;
  onClose: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setProductId("");
      setErr(null);
      setNewOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (newOpen) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose, newOpen]);

  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!open || !pop) return;
    pop.style.transform = "";
    const clip = pop.closest("[data-clip]");
    if (!clip) return;
    const popRect = pop.getBoundingClientRect();
    const clipRect = clip.getBoundingClientRect();
    const pad = 8;
    let dx = 0;
    if (popRect.right > clipRect.right - pad) dx = clipRect.right - pad - popRect.right;
    if (popRect.left + dx < clipRect.left + pad) dx = clipRect.left + pad - popRect.left;
    pop.style.transform = dx ? `translateX(${Math.round(dx)}px)` : "";
  }, [open, newOpen]);

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
    <div className="relative w-full not-first:border-l not-first:border-stone-300">
      <button
        type="button"
        className={`w-full px-3 py-2 text-center text-sm leading-none ${
          open ? "bg-stone-900 text-white" : "text-stone-800 hover:bg-stone-50"
        }`}
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
            <div className="flex items-center gap-1">
              <ComboBox
                key={item.id}
                required
                className="min-w-0 flex-1 rounded border px-2 py-1"
                placeholder="Product"
                value={productId}
                onChange={(id) => {
                  setProductId(id);
                  setErr(null);
                }}
                options={options.map((p) => ({ id: p.id, label: p.label }))}
              />
              {lotId ? (
                <button
                  type="button"
                  className="shrink-0 rounded border border-red-700 px-1.5 py-0.5 text-[11px] leading-none text-red-700"
                  onClick={() => setNewOpen((cur) => !cur)}
                >
                  New
                </button>
              ) : null}
            </div>
          </label>
          {newOpen && lotId ? (
            <NewOrderProductPopup
              lotId={lotId}
              itemId={item.id === "any" ? null : item.id}
              models={models}
              sizes={sizes}
              drops={drops}
              seasons={seasons}
              collections={collections}
              onClose={() => setNewOpen(false)}
            />
          ) : null}
          {err ? (
            <DismissNote className="mb-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <div className="flex gap-2">
            <Btn type="button" busy={pending} onClick={add}>
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

function NewLotPopup({
  orderId,
  brandId,
  lots,
  colors,
  patterns,
  contents,
  onClose,
}: {
  orderId: string;
  brandId: string;
  lots: CatalogLot[];
  colors: LotLookup[];
  patterns: LotLookup[];
  contents: LotLookup[];
  onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const popRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, settingsOpen]);

  function save(formData: FormData) {
    start(async () => {
      const message = await createLotForOrder(orderId, formData);
      if (message) {
        setErr(message);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="absolute bottom-full left-0 z-20 mb-1">
      <form
        ref={popRef}
        className="w-72 rounded-lg border border-stone-200 bg-white p-3 shadow-lg"
        action={save}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-stone-700">New lot</p>
          <button
            type="button"
            className={`rounded border px-1.5 py-0.5 text-[11px] leading-none ${
              settingsOpen
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-400 text-stone-700"
            }`}
            onClick={() => setSettingsOpen((cur) => !cur)}
          >
            Settings
          </button>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <LotAddFields
            lockedBrandId={brandId}
            lots={lots.map((l) => ({
              lot_no: l.lot_no,
              article: l.article ?? null,
              color_num: l.color_num ?? null,
              brand_id: l.brand_id,
              pattern_id: l.pattern_id ?? null,
              content_id: l.content_id ?? null,
            }))}
            brands={[]}
            colors={colors}
            patterns={patterns}
            contents={contents}
          />
          <input
            name="mill_article"
            placeholder="Mill article"
            aria-label="Mill article"
            className="rounded border px-2 py-1"
          />
        </div>
        {err ? (
          <DismissNote className="mt-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
            {err}
          </DismissNote>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Btn type="submit" busy={pending}>
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
      </form>
      {settingsOpen ? (
        <div className="absolute top-0 left-full z-30 ml-2 w-[40rem] max-w-[min(40rem,70vw)] rounded-lg border border-stone-200 bg-stone-50 p-3 shadow-lg">
          <div className="grid gap-3 sm:grid-cols-3">
            <LookupCard title="Colors" table="colors" rows={colors} />
            <LookupCard title="Patterns" table="patterns" rows={patterns} />
            <LookupCard title="Contents" table="contents" rows={contents} asTyped />
          </div>
        </div>
      ) : null}
    </div>
  );
}
