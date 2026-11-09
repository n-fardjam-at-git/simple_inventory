"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DockedPanel } from "@/components/filter/DockedPanel";
import { Btn, Card } from "@/components/ui";
import { ComboBox, reportInvalidCombo } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { useRefreshRow } from "@/components/list/useRefreshRow";
import { UpchargeMatrix, type Cell, type MatrixDrop, type MatrixSize } from "@/components/matrix/QtyMatrix";
import { NumericInput } from "@/components/NumericInput";
import { PriceInput } from "@/components/PriceInput";
import { SysDollar, SysFreight, SysSurcharge } from "@/components/icons/SysImages";
import { CuttingDropQtyGrid } from "../cutting-orders/CuttingDropQtyGrid";
import { QtyCopyPopup, snapshotQtyCopy, type QtyCopy } from "../cutting-orders/QtyCopyPopup";
import { ProductInventoryPopup } from "./ProductInventoryPopup";
import { LINE_STATUS, orderStatusLabel } from "@/lib/customer-order";
import { PRODUCT_TYPE } from "@/lib/product-type";
import { summarizeOrder, type SummaryLine } from "@/lib/order-summary";
import {
  addCustomerOrderCharge,
  addCustomerOrderProductId,
  loadOrderProductDraft,
  removeCustomerOrderProductId,
  saveCustomerOrderCharge,
  pasteCustomerOrderCells,
  saveCustomerOrderPrice,
  saveCustomerOrderQty,
  type OrderProductDraft,
} from "./actions";

export type OrderProductLine = {
  customer_order_id: string;
  product_id: string;
  status: string;
  type: number;
  qty: number | null;
  price: number;
  label: string;
  item_id: string | null;
  item_name: string;
  size_chart_id: string | null;
  ordered: number;
  shipped: number;
  /** Shipped quantity times (line price + size extra). 0 until a shipment writes `qty_shipped`. */
  shipped_value: number;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};

export type CatalogChoice = { id: string; label: string; item_id: string | null };
export type ChargeChoice = { id: string; label: string; type: number; price: number };
export type SetItem = { id: string; name: string };

const ANY: SetItem = { id: "any", name: "Any" };
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const MONEY =
  "inline-flex w-20 shrink-0 items-center justify-end overflow-hidden border border-stone-200 bg-stone-50 px-0.5 py-0 text-xs font-semibold tabular-nums";

export function lineExtended(row: OrderProductLine) {
  if (row.type !== PRODUCT_TYPE.merchandise) {
    const qty = row.type === PRODUCT_TYPE.freight ? 1 : Number(row.qty) || 0;
    return qty * (Number(row.price) || 0);
  }
  const price = Number(row.price) || 0;
  return row.cells.reduce((sum, cell) => {
    const qty = Number(cell.qty) || 0;
    const up = Number(cell.upcharge) || 0;
    return sum + qty * (price + up);
  }, 0);
}

/** An order line in the shape `summarizeOrder` adds up. */
export function summaryLine(row: OrderProductLine): SummaryLine {
  const merchandise = row.type === PRODUCT_TYPE.merchandise;
  return {
    type: row.type,
    status: row.status,
    item: merchandise && row.item_id ? row.item_name : null,
    ordered: merchandise ? row.ordered : row.type === PRODUCT_TYPE.freight ? 1 : Number(row.qty) || 0,
    extended: lineExtended(row),
    shipped: merchandise ? row.shipped : 0,
    shipped_value: merchandise ? row.shipped_value : 0,
  };
}

export function OrderProductsPanel({
  open,
  onClose,
  orderId,
  orderNo,
  customer,
  lines,
  setItems,
  catalog,
  charges,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  orderNo: number | null;
  customer: string | null;
  lines: OrderProductLine[];
  setItems: SetItem[];
  catalog: CatalogChoice[];
  charges: ChargeChoice[];
}) {
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  const [copyProductId, setCopyProductId] = useState<string | null>(null);
  const [copies, setCopies] = useState<QtyCopy[]>([]);
  /** Inventory window opened from the picker bar. Stays open across row selection. */
  const [pickedInv, setPickedInv] = useState<{ productId: string; label: string } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sessionOrderId = useRef("");
  const onOrder = new Set(lines.map((line) => line.product_id));
  const choices = catalog.filter((product) => !onOrder.has(product.id));
  const chargeChoices = charges.filter((charge) => !onOrder.has(charge.id));
  const copyLine =
    lines.find((line) => line.product_id === copyProductId) ?? null;

  useEffect(() => {
    if (!open || !orderId) {
      setPickItemId(null);
      setPickedInv(null);
      setCopyProductId(null);
      setCopies([]);
      sessionOrderId.current = "";
      return;
    }
    setPickItemId(null);
    if (sessionOrderId.current !== orderId) {
      sessionOrderId.current = orderId;
      setPickedInv(null);
      setCopyProductId(null);
      setCopies([]);
    }
  }, [open, orderId]);

  return (
    <>
    <DockedPanel
      open={open}
      onClose={onClose}
      title={
        orderNo != null
          ? `${customer?.trim() || "Order"} · Order No ${orderNo}`
          : customer?.trim() || "Order"
      }
      side="right"
      width="95%"
    >
      {open && orderId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex shrink-0 justify-center">
            <div ref={barRef} className="min-w-56 max-w-full rounded-lg border border-stone-300 bg-white">
              <div className="border-b border-stone-300 bg-stone-100 px-3 py-2 text-center text-sm font-medium text-stone-700">
                Add a product
              </div>
              <div className="grid grid-flow-col auto-cols-fr">
                <ChargePickButton
                  open={pickItemId === "charges"}
                  orderId={orderId}
                  options={chargeChoices}
                  onToggle={() => setPickItemId((cur) => (cur === "charges" ? null : "charges"))}
                  onClose={() => setPickItemId(null)}
                />
                {[ANY, ...setItems].map((item) => (
                  <ItemPickButton
                    key={item.id}
                    item={item}
                    open={pickItemId === item.id}
                    orderId={orderId}
                    options={choices.filter(
                      (product) => item.id === "any" || product.item_id === item.id,
                    )}
                    inventoryOptions={catalog.filter(
                      (product) => item.id === "any" || product.item_id === item.id,
                    )}
                    onToggle={() => setPickItemId((cur) => (cur === item.id ? null : item.id))}
                    onClose={() => setPickItemId(null)}
                    onShowInventory={(choice) => {
                      setPickedInv({ productId: choice.id, label: choice.label });
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <OrderProductTable
            pickedInvProductId={pickedInv?.productId ?? null}
            onPickedInvClose={() => setPickedInv(null)}
            rows={lines}
            copyId={copyLine ? `${copyLine.customer_order_id}:${copyLine.product_id}` : null}
            onCopy={(row) =>
              setCopyProductId((cur) => (cur === row.product_id ? null : row.product_id))
            }
          />
        </div>
      ) : null}
      {open && pickedInv ? (
        <ProductInventoryPopup
          key={pickedInv.productId}
          productId={pickedInv.productId}
          label={pickedInv.label}
          anchor={barRef.current}
          onClose={() => setPickedInv(null)}
        />
      ) : null}
    </DockedPanel>
    <QtyCopyPopup
      open={Boolean(open && copyLine)}
      product={
        copyLine
          ? {
              product_id: copyLine.product_id,
              item_id: copyLine.item_id,
              size_chart_id: copyLine.size_chart_id,
              label: copyLine.label,
              cells: copyLine.cells,
            }
          : null
      }
      copies={copies}
      onCopy={() => {
        if (!copyLine) return;
        const snap = snapshotQtyCopy({
          item_id: copyLine.item_id,
          size_chart_id: copyLine.size_chart_id,
          itemName: copyLine.item_name,
          sizes: copyLine.sizes,
          drops: copyLine.drops,
          cells: copyLine.cells,
        });
        if (!snap) return;
        setCopies((cur) => [...cur, snap]);
      }}
      onPaste={(copy, mode) => {
        if (!copyLine) return Promise.resolve("Open a product first.");
        return pasteCustomerOrderCells(
          copyLine.customer_order_id,
          copyLine.product_id,
          copy.cells,
          copy.itemId,
          copy.sizeChartId,
          mode,
        );
      }}
      onClear={() => setCopies([])}
      onDelete={(id) => setCopies((cur) => cur.filter((copy) => copy.id !== id))}
      onClose={() => setCopyProductId(null)}
    />
    </>
  );
}

function ChargePickButton({
  open,
  orderId,
  options,
  onToggle,
  onClose,
}: {
  open: boolean;
  orderId: string;
  options: ChargeChoice[];
  onToggle: () => void;
  onClose: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const popRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const chosen = options.find((charge) => charge.id === productId) ?? null;
  const freight = chosen?.type === PRODUCT_TYPE.freight;

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
  }, [open, chosen]);

  function add() {
    if (reportInvalidCombo(popRef.current)) return;
    if (!chosen) {
      setErr("Pick a charge.");
      return;
    }
    const formData = new FormData(formRef.current ?? undefined);
    const price = Number(formData.get("price"));
    const qty = freight ? 1 : Number(formData.get("qty"));
    start(async () => {
      const message = await addCustomerOrderCharge(orderId, chosen.id, price, qty);
      if (message) {
        setErr(message);
        return;
      }
      router.refresh();
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
        Charges
      </button>
      {open ? (
        <div
          ref={popRef}
          className="absolute top-full left-0 z-20 mt-1 w-72 max-h-[70vh] overflow-auto rounded-lg border border-stone-200 bg-white p-3 shadow-lg"
        >
          <label className="mb-2 block text-sm">
            <span className="mb-1 block text-stone-500">Charge</span>
            <ComboBox
              required
              className="w-full rounded border px-2 py-1"
              placeholder="Freight or surcharge"
              value={productId}
              onChange={(id) => {
                setProductId(id);
                setErr(null);
              }}
              options={options.map((charge) => ({ id: charge.id, label: charge.label }))}
            />
          </label>
          {chosen ? (
            <form key={chosen.id} ref={formRef} className="mb-3 space-y-3" onSubmit={(e) => e.preventDefault()}>
              {freight ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-500">Cost</span>
                  <PriceInput
                    name="price"
                    defaultValue={chosen.price}
                    className="w-28 rounded border px-2 py-1"
                    aria-label="Cost"
                  />
                </label>
              ) : (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block text-stone-500">Qty</span>
                    <NumericInput
                      name="qty"
                      defaultValue={1}
                      className="w-28 rounded border px-2 py-1"
                      aria-label="Quantity"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-stone-500">Price</span>
                    <PriceInput
                      name="price"
                      defaultValue={chosen.price}
                      className="w-28 rounded border px-2 py-1"
                      aria-label="Price"
                    />
                  </label>
                </>
              )}
            </form>
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

function ItemPickButton({
  item,
  open,
  orderId,
  options,
  inventoryOptions,
  onToggle,
  onClose,
  onShowInventory,
}: {
  item: SetItem;
  open: boolean;
  orderId: string;
  options: CatalogChoice[];
  inventoryOptions: CatalogChoice[];
  onToggle: () => void;
  onClose: () => void;
  onShowInventory: (choice: CatalogChoice) => void;
}) {
  const [productId, setProductId] = useState("");
  const [inventory, setInventory] = useState(false);
  const [draft, setDraft] = useState<OrderProductDraft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const popRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const list = inventory ? inventoryOptions : options;

  useEffect(() => {
    if (!open) {
      setProductId("");
      setInventory(false);
      setDraft(null);
      setErr(null);
    }
  }, [open]);

  useEffect(() => {
    if (!productId || inventory) {
      setDraft(null);
      return;
    }
    let cancel = false;
    setDraft(null);
    void loadOrderProductDraft(productId).then((result) => {
      if (cancel) return;
      if (typeof result === "string") {
        setErr(result);
        return;
      }
      setDraft(result);
    });
    return () => {
      cancel = true;
    };
  }, [productId, inventory]);

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
  }, [open, draft, inventory]);

  function setInventoryMode(on: boolean) {
    setInventory(on);
    setErr(null);
    if (!on && productId && !options.some((product) => product.id === productId)) {
      setProductId("");
    }
  }

  function showInventory() {
    if (reportInvalidCombo(popRef.current)) return;
    const choice = inventoryOptions.find((product) => product.id === productId);
    if (!choice) {
      setErr("Pick a product.");
      return;
    }
    onShowInventory(choice);
  }

  function add() {
    if (reportInvalidCombo(popRef.current)) return;
    if (!productId || !draft) {
      setErr("Pick a product.");
      return;
    }
    const formData = new FormData(formRef.current ?? undefined);
    const price = Number(formData.get("price"));
    const upcharges = [...formData.entries()]
      .filter(([key]) => key.startsWith("up:"))
      .map(([key, value]) => {
        const [, sizeId, dropId] = key.split(":");
        return { size_id: sizeId, drop_id: dropId, amount: Number(value) || 0 };
      })
      .filter((row) => row.size_id && row.drop_id && row.amount > 0);
    start(async () => {
      const message = await addCustomerOrderProductId(orderId, productId, { price, upcharges });
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
          className={`absolute top-full left-0 z-20 mt-1 max-h-[70vh] overflow-auto rounded-lg border border-stone-200 bg-white p-3 shadow-lg ${
            draft ? "w-[40rem]" : "w-72"
          }`}
        >
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span>Inventory</span>
            <button
              type="button"
              role="switch"
              aria-checked={inventory}
              aria-label="Inventory"
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                inventory ? "bg-[#34C759]" : "bg-stone-300"
              }`}
              onClick={() => setInventoryMode(!inventory)}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  inventory ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <label className="mb-2 block text-sm">
            <span className="mb-1 block text-stone-500">Product</span>
            <ComboBox
              key={`${item.id}-${inventory ? "inv" : "add"}`}
              required
              className="w-full rounded border px-2 py-1"
              placeholder="Product"
              value={productId}
              onChange={(id) => {
                setProductId(id);
                setErr(null);
              }}
              options={list.map((product) => ({ id: product.id, label: product.label }))}
            />
          </label>
          {!inventory && draft ? (
            <form ref={formRef} className="mb-3 space-y-3" onSubmit={(e) => e.preventDefault()}>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Price</span>
                <PriceInput
                  name="price"
                  defaultValue={draft.price}
                  className="w-28 rounded border px-2 py-1"
                  aria-label="Price"
                />
              </label>
              {draft.sizes.length && draft.drops.length ? (
                <div>
                  <p className="mb-1 text-xs text-teal-800">Size extra on this order</p>
                  <UpchargeMatrix sizes={draft.sizes} drops={draft.drops} cells={draft.cells} />
                </div>
              ) : null}
            </form>
          ) : null}
          {err ? (
            <DismissNote className="mb-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <div className="flex gap-2">
            {inventory ? (
              <Btn type="button" onClick={showInventory}>
                Inventory
              </Btn>
            ) : (
              <Btn type="button" busy={pending} onClick={add}>
                Add
              </Btn>
            )}
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

function OrderProductTable({
  rows,
  copyId,
  onCopy,
  pickedInvProductId,
  onPickedInvClose,
}: {
  rows: OrderProductLine[];
  copyId: string | null;
  onCopy: (row: OrderProductLine) => void;
  pickedInvProductId: string | null;
  onPickedInvClose: () => void;
}) {
  const items = [...rows].sort((a, b) => {
    if (a.type !== b.type) return a.type - b.type;
    return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FitList
        items={items}
        getKey={(row) => `${row.customer_order_id}:${row.product_id}`}
        stretch
        tableClassName="inventory-boards table-fixed"
        thead={
          <>
            <thead>
              <tr className="text-stone-500">
                <th className="w-[16%] py-1">Product</th>
                <th className="py-1"></th>
                <th className="w-52 py-1"></th>
              </tr>
            </thead>
          </>
        }
        renderRow={(row) =>
          row.type === PRODUCT_TYPE.merchandise ? (
            <ProductLineRow
              row={row}
              copyOpen={copyId === `${row.customer_order_id}:${row.product_id}`}
              onCopy={() => onCopy(row)}
              pickedInvOpen={pickedInvProductId != null}
              onRowInventoryOpen={onPickedInvClose}
            />
          ) : (
            <ChargeLineRow row={row} />
          )
        }
      />
      <OrderExtendedTotals rows={rows} />
    </div>
  );
}

function OrderExtendedTotals({ rows }: { rows: OrderProductLine[] }) {
  const { freight, surcharge, merchandise, total } = summarizeOrder(rows.map(summaryLine));
  const parts = [
    ["Freight", freight],
    ["Surcharge", surcharge],
    ["Merchandise", merchandise],
    ["Total", total],
  ] as const;
  return (
    <div className="mt-2 flex shrink-0 justify-end pr-[calc(0.75rem+0.5rem+2px)]">
      <div className="grid grid-cols-[auto_5rem] items-center gap-x-3 gap-y-1">
        {parts.map(([label, amount]) => (
          <div key={label} className="contents">
            <span className="text-right text-xs text-stone-500">{label}</span>
            <span className={MONEY}>{usd.format(amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductLineRow({
  row,
  copyOpen,
  onCopy,
  pickedInvOpen,
  onRowInventoryOpen,
}: {
  row: OrderProductLine;
  copyOpen: boolean;
  onCopy: () => void;
  /** The picker-bar inventory window is open. Only one window at a time. */
  pickedInvOpen: boolean;
  onRowInventoryOpen: () => void;
}) {
  const [status, setStatus] = useState(row.status);
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [extended, setExtended] = useState(() => lineExtended(row));
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const list = useList();
  const router = useRouter();
  const refreshRow = useRefreshRow(row);
  const id = `${row.customer_order_id}:${row.product_id}`;
  const dirty = status !== row.status || matrixDirty;
  const [invOpen, setInvOpen] = useState(false);
  const invBtn = useRef<HTMLButtonElement>(null);
  const invArmed = useRef(false);

  function toggleInventory() {
    if (invOpen) {
      setInvOpen(false);
      return;
    }
    if (list.selectedId !== id) list.requestSelect(id);
    onRowInventoryOpen();
    setInvOpen(true);
  }

  useEffect(() => {
    if (pickedInvOpen) setInvOpen(false);
  }, [pickedInvOpen]);

  // The popup belongs to this row. Selecting another row (or none) closes it.
  useEffect(() => {
    if (!invOpen) {
      invArmed.current = false;
      return;
    }
    if (list.selectedId === id) {
      invArmed.current = true;
      return;
    }
    if (invArmed.current) setInvOpen(false);
  }, [invOpen, list.selectedId, id]);

  function persist() {
    return new Promise<boolean>((resolve) => {
      if (busy.current) {
        resolve(false);
        return;
      }
      const form = formRef.current;
      const formData = form ? new FormData(form) : new FormData();
      busy.current = true;
      setSaving(true);
      void (async () => {
        try {
          const message = await saveCustomerOrderQty(
            row.customer_order_id,
            row.product_id,
            status,
            formData,
          );
          if (message) {
            setErr(message);
            resolve(false);
            return;
          }
          setErr(null);
          await refreshRow();
          setMatrixDirty(false);
          list.finishEdit(id);
          resolve(true);
        } finally {
          busy.current = false;
          setSaving(false);
        }
      })();
    });
  }

  const { editing, requestEdit, requestCancel } = useListRow(id, {
    dirty,
    revert: () => {
      setStatus(row.status);
      setMatrixDirty(false);
      setFormKey((key) => key + 1);
      setErr(null);
    },
    save: persist,
  });

  useEffect(() => {
    if (!editing) {
      setStatus(row.status);
      setPriceOpen(false);
    }
  }, [row.status, editing]);

  return (
    <SelectableRow id={id} keepSelected={invOpen}>
      <td className="w-[16%] min-w-0 break-words pr-2">
        <div className="flex flex-wrap items-center gap-1 font-medium leading-tight">
          <span>{row.label}</span>
          <span className="font-light text-stone-500">${Number(row.price).toFixed(2)}</span>
          {editing ? (
            <button
              type="button"
              className="rounded p-0.5 hover:bg-stone-100"
              aria-label="Price and size extras"
              title="Price and size extras"
              onClick={(e) => {
                e.stopPropagation();
                setPriceOpen(true);
              }}
            >
              <SysDollar />
            </button>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs leading-tight">
          {editing ? (
            <select
              aria-label="Line status"
              className="rounded border px-1 py-0.5"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {LINE_STATUS.map((item) => (
                <option key={item} value={item}>
                  {orderStatusLabel(item)}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-light text-stone-500">{orderStatusLabel(row.status)}</span>
          )}
          <span className="font-light text-stone-500">
            {row.shipped} of {row.ordered}
          </span>
        </div>
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
        {priceOpen ? (
          <PriceExtrasCard
            row={row}
            onClose={() => setPriceOpen(false)}
            onSaved={refreshRow}
          />
        ) : null}
        {invOpen ? (
          <ProductInventoryPopup
            productId={row.product_id}
            label={row.label}
            sizes={row.sizes}
            drops={row.drops}
            anchor={invBtn.current?.closest("tr") ?? null}
            onClose={() => setInvOpen(false)}
          />
        ) : null}
      </td>
      <td className="w-full min-w-0 pr-1">
        {editing ? (
          <form
            key={formKey}
            ref={formRef}
            className="min-w-0 w-full"
            onInput={() => setMatrixDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              void persist();
            }}
          >
            <CuttingDropQtyGrid
              sizes={row.sizes}
              drops={row.drops}
              cells={row.cells}
              editable
              qtyOnly
              namePrefix="ord"
              linePrice={row.price}
              onExtendedChange={setExtended}
              onDirty={() => setMatrixDirty(true)}
            />
          </form>
        ) : (
          <div
            className="cursor-pointer"
            title="Double click to edit"
            onDoubleClick={(e) => {
              e.stopPropagation();
              requestEdit();
            }}
          >
            <CuttingDropQtyGrid
              qtyOnly
              linePrice={row.price}
              onExtendedChange={setExtended}
              sizes={row.sizes}
              drops={row.drops}
              cells={row.cells}
            />
          </div>
        )}
      </td>
      <td className="h-px w-52 pr-2 align-top">
        <div className="flex h-full flex-col justify-between gap-1 pt-1">
          <div className="min-w-36">
          <RowButtons
            editing={editing}
            dirty={dirty}
            saving={saving}
            deleting={pending}
            before={
              <>
                <button
                  ref={invBtn}
                  type="button"
                  className={`text-xs underline ${
                    invOpen ? "font-medium text-teal-800" : "text-stone-700"
                  }`}
                  onClick={toggleInventory}
                >
                  Inventory
                </button>
                <button
                  type="button"
                  className={`text-xs underline ${
                    copyOpen ? "font-medium text-teal-800" : "text-stone-700"
                  }`}
                  onClick={onCopy}
                >
                  Copy
                </button>
              </>
            }
            onEdit={requestEdit}
            onSave={() => void persist()}
            onCancel={requestCancel}
            onDelete={
              editing
                ? undefined
                : () => {
                    if (!confirm(`Remove ${row.label}?`)) return;
                    start(async () => {
                      const message = await removeCustomerOrderProductId(
                        row.customer_order_id,
                        row.product_id,
                      );
                      if (message) setErr(message);
                      else router.refresh();
                    });
                  }
            }
          />
          </div>
          <div className="mt-1 flex justify-end">
            <span className={MONEY}>{usd.format(extended)}</span>
          </div>
        </div>
      </td>
    </SelectableRow>
  );
}

function ChargeLineRow({ row }: { row: OrderProductLine }) {
  const freight = row.type === PRODUCT_TYPE.freight;
  const [status, setStatus] = useState(row.status);
  const [priceText, setPriceText] = useState(() => String(row.price));
  const [qtyText, setQtyText] = useState(() => String(row.qty ?? 1));
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const busy = useRef(false);
  const list = useList();
  const router = useRouter();
  const refreshRow = useRefreshRow(row);
  const id = `${row.customer_order_id}:${row.product_id}`;
  const dirty =
    status !== row.status ||
    priceText !== String(row.price) ||
    (!freight && qtyText !== String(row.qty ?? 1));
  const priceNum = Number(priceText);
  const qtyNum = freight ? 1 : Math.trunc(Number(qtyText));
  const extended =
    (Number.isFinite(qtyNum) && qtyNum >= 0 ? qtyNum : 0) *
    (Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0);

  function persist() {
    return new Promise<boolean>((resolve) => {
      if (busy.current) {
        resolve(false);
        return;
      }
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        setErr(freight ? "Enter a cost." : "Enter a price.");
        resolve(false);
        return;
      }
      if (!freight && (!Number.isFinite(qtyNum) || qtyNum < 0)) {
        setErr("Enter a quantity.");
        resolve(false);
        return;
      }
      busy.current = true;
      setSaving(true);
      void (async () => {
        try {
          const message = await saveCustomerOrderCharge(
            row.customer_order_id,
            row.product_id,
            status,
            priceNum,
            qtyNum,
          );
          if (message) {
            setErr(message);
            resolve(false);
            return;
          }
          setErr(null);
          await refreshRow();
          list.finishEdit(id);
          resolve(true);
        } finally {
          busy.current = false;
          setSaving(false);
        }
      })();
    });
  }

  const { editing, requestEdit, requestCancel } = useListRow(id, {
    dirty,
    revert: () => {
      setStatus(row.status);
      setPriceText(String(row.price));
      setQtyText(String(row.qty ?? 1));
      setFormKey((key) => key + 1);
      setErr(null);
    },
    save: persist,
  });

  useEffect(() => {
    if (!editing) {
      setStatus(row.status);
      setPriceText(String(row.price));
      setQtyText(String(row.qty ?? 1));
    }
  }, [row.status, row.price, row.qty, editing]);

  return (
    <SelectableRow id={id}>
      <td className="w-[16%] min-w-0 break-words pr-2">
        <div className="font-medium leading-tight">{row.label}</div>
        <div className="mt-1 text-xs leading-tight">
          {editing ? (
            <select
              aria-label="Line status"
              className="rounded border px-1 py-0.5"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {LINE_STATUS.map((item) => (
                <option key={item} value={item}>
                  {orderStatusLabel(item)}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-light text-stone-500">{orderStatusLabel(row.status)}</span>
          )}
        </div>
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      <td className="w-full min-w-0 pr-1">
        <div className="flex items-center gap-3">
          <div
            className={editing ? undefined : "cursor-pointer"}
            title={editing ? undefined : "Double click to edit"}
            onDoubleClick={
              editing
                ? undefined
                : (e) => {
                    e.stopPropagation();
                    requestEdit();
                  }
            }
          >
            {freight ? <SysFreight /> : <SysSurcharge />}
          </div>
          <div className="min-w-0">
        {editing ? (
          <form key={formKey} className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
            {freight ? (
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Cost</span>
                <PriceInput
                  name="price"
                  defaultValue={row.price}
                  className="w-28 rounded border px-2 py-1"
                  aria-label="Cost"
                  onChange={(e) => setPriceText(e.target.value.replace(/[^0-9.]/g, ""))}
                />
              </label>
            ) : (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-500">Qty</span>
                  <NumericInput
                    name="qty"
                    defaultValue={row.qty ?? 1}
                    className="w-28 rounded border px-2 py-1"
                    aria-label="Quantity"
                    onChange={(e) => setQtyText(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-500">Price</span>
                  <PriceInput
                    name="price"
                    defaultValue={row.price}
                    className="w-28 rounded border px-2 py-1"
                    aria-label="Price"
                    onChange={(e) => setPriceText(e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                </label>
              </>
            )}
          </form>
        ) : freight ? (
          <span className="text-sm tabular-nums">{usd.format(Number(row.price) || 0)}</span>
        ) : (
          <span className="text-sm tabular-nums">
            {Number(row.qty) || 0} × {usd.format(Number(row.price) || 0)}
          </span>
        )}
          </div>
        </div>
      </td>
      <td className="h-px w-52 pr-2 align-top">
        <div className="flex h-full min-h-14 flex-col justify-between gap-1 pt-1">
          <div className="min-w-36 [&>div]:flex-nowrap">
            <RowButtons
              editing={editing}
              dirty={dirty}
              saving={saving}
              deleting={pending}
              onEdit={requestEdit}
              onSave={() => void persist()}
              onCancel={requestCancel}
              onDelete={
                editing
                  ? undefined
                  : () => {
                      if (!confirm(`Remove ${row.label}?`)) return;
                      start(async () => {
                        const message = await removeCustomerOrderProductId(
                          row.customer_order_id,
                          row.product_id,
                        );
                        if (message) setErr(message);
                        else router.refresh();
                      });
                    }
              }
            />
          </div>
          <div className="mt-1 flex justify-end">
            <span className={MONEY}>{usd.format(editing ? extended : lineExtended(row))}</span>
          </div>
        </div>
      </td>
    </SelectableRow>
  );
}

function PriceExtrasCard({
  row,
  onClose,
  onSaved,
}: {
  row: OrderProductLine;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!saving) onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, saving]);

  function close() {
    if (saving) return;
    onClose();
  }

  function persist() {
    if (saving) return;
    const formData = new FormData(formRef.current ?? undefined);
    const raw = String(formData.get("price") ?? "").trim();
    const price = Number(raw);
    if (!raw || !Number.isFinite(price) || price < 0) {
      setErr("Enter a price.");
      return;
    }
    const upcharges = [...formData.entries()]
      .filter(([key]) => key.startsWith("up:"))
      .map(([key, value]) => {
        const [, sizeId, dropId] = key.split(":");
        return { size_id: sizeId, drop_id: dropId, amount: Number(value) || 0 };
      })
      .filter((item) => item.size_id && item.drop_id);
    setSaving(true);
    start(async () => {
      try {
        const message = await saveCustomerOrderPrice(
          row.customer_order_id,
          row.product_id,
          price,
          upcharges,
        );
        if (message) {
          setErr(message);
          return;
        }
        await onSaved();
        onClose();
      } finally {
        setSaving(false);
      }
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4"
      onClick={close}
    >
      <Card
        className="max-h-[90vh] w-full max-w-3xl overflow-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="min-w-0 font-medium">{row.label}</p>
          <button
            type="button"
            className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
            aria-label="Close"
            onClick={close}
          >
            ×
          </button>
        </div>
        <form
          ref={formRef}
          className="space-y-3 text-sm"
          onInput={() => setDirty(true)}
          onSubmit={(e) => {
            e.preventDefault();
            persist();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-stone-500">Price</span>
            <PriceInput
              name="price"
              defaultValue={Number(row.price).toFixed(2)}
              className="w-28 rounded border px-2 py-1"
              aria-label="Price"
              onChange={() => setDirty(true)}
            />
          </label>
          {row.sizes.length && row.drops.length ? (
            <div>
              <p className="mb-1 text-xs text-teal-800">Size extra on this order</p>
              <UpchargeMatrix sizes={row.sizes} drops={row.drops} cells={row.cells} />
            </div>
          ) : null}
          {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
          {dirty || saving ? (
            <div className="flex items-center gap-2">
              <Btn type="button" busy={saving} onClick={persist}>
                Save
              </Btn>
              <button
                type="button"
                className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
                onClick={close}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </form>
      </Card>
    </div>,
    document.body,
  );
}
