"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DockedPanel } from "@/components/filter/DockedPanel";
import { Btn } from "@/components/ui";
import { ComboBox, reportInvalidCombo } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { FitList } from "@/components/list/FitList";
import { ListTable, RowButtons, SelectableRow, useList, useListRow } from "@/components/list/ListTable";
import { useRefreshRow } from "@/components/list/useRefreshRow";
import type { MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { NumericInput } from "@/components/NumericInput";
import { PriceInput } from "@/components/PriceInput";
import { SysFreight, SysSurcharge } from "@/components/icons/SysImages";
import { isOpenShipment } from "@/lib/customer-shipment";
import { summarizeOrder, type SummaryLine } from "@/lib/order-summary";
import { PRODUCT_TYPE } from "@/lib/product-type";
import { CuttingDropQtyGrid } from "../cutting-orders/CuttingDropQtyGrid";
import {
  addChargeToShipment,
  addOrderToShipment,
  loadAddableOrderProducts,
  removeShipmentLineById,
  type AddableOrderLine,
  saveShipmentLineCharge,
  saveShipmentLineQty,
} from "./actions";

/** `price` is the full unit price, copied from the order when the line was added. */
export type ShipmentCell = { size_id: string; drop_id: string; qty: number; price: number };

export type ShipmentLine = {
  id: string;
  customer_shipment_id: string;
  /** Null for freight or a surcharge that is not on an order. */
  order_no: number | null;
  product_id: string;
  type: number;
  label: string;
  /** Item of the merchandise model (Suits, Pants), for the summary. */
  item_name: string | null;
  /** Charge lines only. */
  qty: number;
  price: number;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: ShipmentCell[];
};

export type ShipmentOrderChoice = { id: string; customer_id: string; label: string };
export type ShipmentChargeChoice = { id: string; label: string };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const MONEY =
  "inline-flex w-20 shrink-0 items-center justify-end overflow-hidden border border-stone-200 bg-stone-50 px-0.5 py-0 text-xs font-semibold tabular-nums";

export function lineAmount(line: ShipmentLine) {
  if (line.type === PRODUCT_TYPE.merchandise) {
    return line.cells.reduce((sum, cell) => sum + cell.qty * cell.price, 0);
  }
  return (line.type === PRODUCT_TYPE.freight ? 1 : line.qty) * line.price;
}

/** A shipment line in the shape `summarizeOrder` adds up. A shipment has no canceled lines. */
export function shipmentSummaryLine(line: ShipmentLine): SummaryLine {
  const merchandise = line.type === PRODUCT_TYPE.merchandise;
  return {
    type: line.type,
    status: "open",
    item: merchandise ? line.item_name : null,
    ordered: merchandise
      ? line.cells.reduce((sum, cell) => sum + cell.qty, 0)
      : line.type === PRODUCT_TYPE.freight
        ? 1
        : line.qty,
    extended: lineAmount(line),
    shipped: 0,
    shipped_value: 0,
  };
}

export function ShipmentProductsPanel({
  open,
  onClose,
  shipment,
  lines,
  canWrite,
  orders,
  charges,
}: {
  open: boolean;
  onClose: () => void;
  shipment: {
    id: string;
    shipment_no: number;
    customer: string;
    customer_id: string;
    status: string;
  } | null;
  lines: ShipmentLine[];
  /** Admin and warehouse. A sales rep only reads. */
  canWrite: boolean;
  orders: ShipmentOrderChoice[];
  charges: ShipmentChargeChoice[];
}) {
  const [pick, setPick] = useState<null | "order" | "charge">(null);
  const shipmentId = shipment?.id ?? null;
  const editable = canWrite && isOpenShipment(shipment?.status);

  useEffect(() => {
    setPick(null);
  }, [open, shipmentId]);

  const onShipment = new Set(
    lines.filter((line) => line.order_no == null).map((line) => line.product_id),
  );

  return (
    <DockedPanel
      open={open}
      onClose={onClose}
      title={
        shipment
          ? `${shipment.customer.trim() || "Shipment"} · Shipment No ${shipment.shipment_no}`
          : "Shipment"
      }
      side="right"
      width="95%"
    >
      {open && shipment ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {editable ? (
            <div className="mb-3 flex shrink-0 justify-center">
              <div className="min-w-56 max-w-full rounded-lg border border-stone-300 bg-white">
                <div className="border-b border-stone-300 bg-stone-100 px-3 py-2 text-center text-sm font-medium text-stone-700">
                  Add to shipment
                </div>
                <div className="grid grid-flow-col auto-cols-fr">
                  <AddOrderPick
                    shipmentId={shipment.id}
                    options={orders
                      .filter((order) => order.customer_id === shipment.customer_id)
                      .map((order) => ({ id: order.id, label: order.label }))}
                    open={pick === "order"}
                    onToggle={() => setPick((cur) => (cur === "order" ? null : "order"))}
                    onClose={() => setPick(null)}
                  />
                  <AddPick
                    label="Charges"
                    placeholder="Freight or surcharge"
                    pickMessage="Pick a charge."
                    emptyMessage="Every charge is already on this shipment."
                    options={charges.filter((charge) => !onShipment.has(charge.id))}
                    open={pick === "charge"}
                    onToggle={() => setPick((cur) => (cur === "charge" ? null : "charge"))}
                    onClose={() => setPick(null)}
                    onAdd={(productId) => addChargeToShipment(shipment.id, productId)}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <ShipmentLineTable rows={lines} editable={editable} />
        </div>
      ) : null}
    </DockedPanel>
  );
}

const POPUP_CANCEL =
  "rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50";

/**
 * Order on the Add to shipment bar. Picking an order widens the popup and lists the
 * products of that order that can still go on this shipment, each with a checkbox.
 * Add puts only the checked ones on, with what is left to ship.
 */
function AddOrderPick({
  shipmentId,
  options,
  open,
  onToggle,
  onClose,
}: {
  shipmentId: string;
  options: { id: string; label: string }[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [orderId, setOrderId] = useState("");
  /** The addable products of the picked order. Null until they are read. */
  const [lines, setLines] = useState<AddableOrderLine[] | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const picked = options.some((option) => option.id === orderId);

  useEffect(() => {
    if (!open) {
      setOrderId("");
      setLines(null);
      setChecked(new Set());
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

  // The list is read each time an order is picked. Every row starts checked.
  useEffect(() => {
    setLines(null);
    setChecked(new Set());
    if (!open || !picked) return;
    let alive = true;
    void loadAddableOrderProducts(shipmentId, orderId).then((result) => {
      if (!alive) return;
      if ("error" in result) {
        setErr(result.error);
        setLines([]);
        return;
      }
      setLines(result.lines);
      setChecked(new Set(result.lines.map((line) => line.product_id)));
    });
    return () => {
      alive = false;
    };
  }, [open, picked, orderId, shipmentId]);

  const allChecked = Boolean(lines?.length) && lines!.every((line) => checked.has(line.product_id));

  function toggle(productId: string) {
    setErr(null);
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleAll() {
    setErr(null);
    setChecked(allChecked ? new Set() : new Set((lines ?? []).map((line) => line.product_id)));
  }

  async function add() {
    if (busy) return;
    if (reportInvalidCombo(popRef.current)) return;
    if (!picked) {
      setErr("Pick an order.");
      return;
    }
    if (!lines) return;
    const productIds = lines
      .filter((line) => checked.has(line.product_id))
      .map((line) => line.product_id);
    if (!productIds.length) {
      setErr("Check at least one product.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const message = await addOrderToShipment(shipmentId, orderId, productIds);
      if (message) {
        setErr(message);
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
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
        Order
      </button>
      {open ? (
        <div
          ref={popRef}
          className={`absolute top-full left-0 z-20 mt-1 max-h-[70vh] max-w-[90vw] overflow-auto rounded-lg border border-stone-200 bg-white p-3 shadow-lg ${
            picked ? "w-[32rem]" : "w-72"
          }`}
        >
          {options.length ? (
            <label className="mb-2 block text-sm">
              <span className="mb-1 block text-stone-500">Order</span>
              <ComboBox
                required
                className="w-full rounded border px-2 py-1"
                placeholder="Order"
                aria-label="Order"
                value={orderId}
                onChange={(id) => {
                  setOrderId(id);
                  setErr(null);
                }}
                options={options}
              />
            </label>
          ) : (
            <p className="mb-2 text-sm text-stone-500">This customer has no approved order to ship.</p>
          )}
          {picked ? (
            lines === null ? (
              <p className="mb-2 text-sm text-stone-500">Loading…</p>
            ) : lines.length ? (
              <>
                <p className="mb-2 text-xs text-stone-500">
                  Only the checked products are added, each with what is left to ship.
                </p>
                <div className="mb-2 max-h-72 overflow-auto rounded-lg border border-stone-300 bg-white px-3 py-1">
                  <ListTable className="inventory-boards">
                    <thead>
                      <tr className="text-stone-500">
                        <th className="w-10 py-1 pl-5">
                          <input
                            type="checkbox"
                            aria-label="Check every product"
                            title={allChecked ? "Uncheck every product" : "Check every product"}
                            checked={allChecked}
                            onChange={toggleAll}
                          />
                        </th>
                        <th className="py-1">Product</th>
                        <th className="w-24 py-1 pr-2 text-right">To add</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr
                          key={line.product_id}
                          className="cursor-pointer"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("input")) return;
                            toggle(line.product_id);
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Add ${line.label}`}
                              checked={checked.has(line.product_id)}
                              onChange={() => toggle(line.product_id)}
                            />
                          </td>
                          <td>{line.label}</td>
                          <td className="pr-2 text-right tabular-nums">
                            {line.type === PRODUCT_TYPE.merchandise
                              ? line.qty
                              : usd.format(line.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </ListTable>
                </div>
              </>
            ) : err ? null : (
              <p className="mb-2 text-sm text-stone-500">Nothing is left to ship on this order.</p>
            )
          ) : null}
          {err ? (
            <DismissNote className="mb-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <div className="flex gap-2">
            {options.length && (!picked || lines?.length) ? (
              <Btn type="button" busy={busy} onClick={() => void add()}>
                Add
              </Btn>
            ) : null}
            <button type="button" className={POPUP_CANCEL} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Charges on the Add to shipment bar. Its popup is a Combo and Add. */
function AddPick({
  label,
  placeholder,
  pickMessage,
  emptyMessage,
  hint,
  options,
  open,
  onToggle,
  onClose,
  onAdd,
}: {
  label: string;
  placeholder: string;
  pickMessage: string;
  emptyMessage: string;
  hint?: string;
  options: { id: string; label: string }[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAdd: (id: string) => Promise<string | null>;
}) {
  const [pickedId, setPickedId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setPickedId("");
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

  async function add() {
    if (busy) return;
    if (reportInvalidCombo(popRef.current)) return;
    if (!options.some((option) => option.id === pickedId)) {
      setErr(pickMessage);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const message = await onAdd(pickedId);
      if (message) {
        setErr(message);
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
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
        {label}
      </button>
      {open ? (
        <div
          ref={popRef}
          className="absolute top-full left-0 z-20 mt-1 max-h-[70vh] w-72 overflow-auto rounded-lg border border-stone-200 bg-white p-3 shadow-lg"
        >
          {options.length ? (
            <>
              <label className="mb-2 block text-sm">
                <span className="mb-1 block text-stone-500">{label === "Charges" ? "Charge" : label}</span>
                <ComboBox
                  required
                  className="w-full rounded border px-2 py-1"
                  placeholder={placeholder}
                  aria-label={placeholder}
                  value={pickedId}
                  onChange={(id) => {
                    setPickedId(id);
                    setErr(null);
                  }}
                  options={options}
                />
              </label>
              {hint ? <p className="mb-2 text-xs text-stone-500">{hint}</p> : null}
            </>
          ) : (
            <p className="mb-2 text-sm text-stone-500">{emptyMessage}</p>
          )}
          {err ? (
            <DismissNote className="mb-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <div className="flex gap-2">
            {options.length ? (
              <Btn type="button" busy={busy} onClick={() => void add()}>
                Add
              </Btn>
            ) : null}
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

function ShipmentLineTable({ rows, editable }: { rows: ShipmentLine[]; editable: boolean }) {
  const items = [...rows].sort(
    (a, b) =>
      (a.order_no ?? Number.MAX_SAFE_INTEGER) - (b.order_no ?? Number.MAX_SAFE_INTEGER) ||
      a.type - b.type ||
      a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FitList
        items={items}
        getKey={(row) => row.id}
        stretch
        tableClassName="inventory-boards table-fixed"
        thead={
          <thead>
            <tr className="text-stone-500">
              <th className="w-[16%] py-1">Product</th>
              <th className="py-1"></th>
              <th className="w-52 py-1"></th>
            </tr>
          </thead>
        }
        renderRow={(row) =>
          row.type === PRODUCT_TYPE.merchandise ? (
            <ProductLineRow row={row} editable={editable} />
          ) : (
            <ChargeLineRow row={row} editable={editable} />
          )
        }
      />
      <ShipmentTotals rows={rows} />
    </div>
  );
}

function ShipmentTotals({ rows }: { rows: ShipmentLine[] }) {
  const { freight, surcharge, merchandise, total } = summarizeOrder(rows.map(shipmentSummaryLine));
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

function orderText(row: ShipmentLine) {
  return row.order_no == null ? "No order" : `Order No ${row.order_no}`;
}

function ProductLineRow({ row, editable }: { row: ShipmentLine; editable: boolean }) {
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** The amount of the quantities being typed. Null shows the saved amount. */
  const [typed, setTyped] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const list = useList();
  const router = useRouter();
  const refreshRow = useRefreshRow(row);
  const priceAt = new Map(row.cells.map((cell) => [`${cell.size_id}:${cell.drop_id}`, cell.price]));
  const cells = row.cells.map((cell) => ({
    size_id: cell.size_id,
    drop_id: cell.drop_id,
    qty: cell.qty,
  }));

  function recount() {
    const form = formRef.current;
    if (!form) return;
    let total = 0;
    for (const [name, value] of new FormData(form).entries()) {
      if (!name.startsWith("cell:")) continue;
      const [, sizeId, dropId] = name.split(":");
      total += (Number(value) || 0) * (priceAt.get(`${sizeId}:${dropId}`) ?? 0);
    }
    setTyped(total);
  }

  function touched() {
    setMatrixDirty(true);
    // A drop row taken off the grid leaves the form after this render.
    requestAnimationFrame(recount);
  }

  function persist() {
    return new Promise<boolean>((resolve) => {
      if (busy.current) {
        resolve(false);
        return;
      }
      const form = formRef.current;
      const formData = form ? new FormData(form) : new FormData();
      // A drop row taken off the grid sends nothing, so its sizes are saved as 0.
      const shownSizes = new Set(row.sizes.map((size) => size.id));
      const shownDrops = new Set(row.drops.map((drop) => drop.id));
      for (const cell of row.cells) {
        const name = `cell:${cell.size_id}:${cell.drop_id}`;
        if (formData.has(name)) continue;
        if (shownSizes.has(cell.size_id) && shownDrops.has(cell.drop_id)) formData.set(name, "0");
      }
      busy.current = true;
      setSaving(true);
      void (async () => {
        try {
          const message = await saveShipmentLineQty(row.customer_shipment_id, row.id, formData);
          if (message) {
            setErr(message);
            resolve(false);
            return;
          }
          setErr(null);
          await refreshRow();
          setMatrixDirty(false);
          setTyped(null);
          list.finishEdit(row.id);
          resolve(true);
        } finally {
          busy.current = false;
          setSaving(false);
        }
      })();
    });
  }

  const { editing, requestEdit, requestCancel } = useListRow(row.id, {
    dirty: matrixDirty,
    revert: () => {
      setMatrixDirty(false);
      setTyped(null);
      setFormKey((key) => key + 1);
      setErr(null);
    },
    save: persist,
  });

  async function remove() {
    if (removing) return;
    if (!confirm(`Remove ${row.label}?`)) return;
    setRemoving(true);
    try {
      const message = await removeShipmentLineById(row.customer_shipment_id, row.id);
      if (message) setErr(message);
      else router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <SelectableRow id={row.id}>
      <td className="w-[16%] min-w-0 break-words pr-2">
        <div className="font-medium leading-tight">{row.label}</div>
        <div className="mt-1 text-xs leading-tight font-light text-stone-500">{orderText(row)}</div>
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      <td className="w-full min-w-0 pr-1">
        {editing ? (
          <form
            key={formKey}
            ref={formRef}
            className="min-w-0 w-full"
            onInput={touched}
            onSubmit={(e) => {
              e.preventDefault();
              void persist();
            }}
          >
            <CuttingDropQtyGrid
              sizes={row.sizes}
              drops={row.drops}
              cells={cells}
              editable
              namePrefix="cell"
              onDirty={touched}
            />
          </form>
        ) : (
          <div
            className={editable ? "cursor-pointer" : undefined}
            title={editable ? "Double click to edit" : undefined}
            onDoubleClick={
              editable
                ? (e) => {
                    e.stopPropagation();
                    requestEdit();
                  }
                : undefined
            }
          >
            <CuttingDropQtyGrid sizes={row.sizes} drops={row.drops} cells={cells} />
          </div>
        )}
      </td>
      <td className="h-px w-52 pr-2 align-top">
        <div className="flex h-full flex-col justify-between gap-1 pt-1">
          <div className="min-w-36">
            {editable ? (
              <RowButtons
                editing={editing}
                dirty={matrixDirty}
                saving={saving}
                deleting={removing}
                onEdit={requestEdit}
                onSave={() => void persist()}
                onCancel={requestCancel}
                onDelete={editing ? undefined : () => void remove()}
              />
            ) : null}
          </div>
          <div className="mt-1 flex justify-end">
            <span className={MONEY}>{usd.format(editing && typed != null ? typed : lineAmount(row))}</span>
          </div>
        </div>
      </td>
    </SelectableRow>
  );
}

function ChargeLineRow({ row, editable }: { row: ShipmentLine; editable: boolean }) {
  const freight = row.type === PRODUCT_TYPE.freight;
  const [priceText, setPriceText] = useState(() => String(row.price));
  const [qtyText, setQtyText] = useState(() => String(row.qty));
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const busy = useRef(false);
  const list = useList();
  const router = useRouter();
  const refreshRow = useRefreshRow(row);
  const dirty = priceText !== String(row.price) || (!freight && qtyText !== String(row.qty));
  const priceNum = Number(priceText);
  const qtyNum = freight ? 1 : Math.trunc(Number(qtyText));
  const typed =
    (Number.isFinite(qtyNum) && qtyNum >= 0 ? qtyNum : 0) *
    (Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0);

  function persist() {
    return new Promise<boolean>((resolve) => {
      if (busy.current) {
        resolve(false);
        return;
      }
      if (priceText.trim() === "" || !Number.isFinite(priceNum) || priceNum < 0) {
        setErr(freight ? "Enter a cost." : "Enter a price.");
        resolve(false);
        return;
      }
      if (!freight && (qtyText.trim() === "" || !Number.isFinite(qtyNum) || qtyNum < 0)) {
        setErr("Enter a quantity.");
        resolve(false);
        return;
      }
      busy.current = true;
      setSaving(true);
      void (async () => {
        try {
          const message = await saveShipmentLineCharge(
            row.customer_shipment_id,
            row.id,
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
          list.finishEdit(row.id);
          resolve(true);
        } finally {
          busy.current = false;
          setSaving(false);
        }
      })();
    });
  }

  const { editing, requestEdit, requestCancel } = useListRow(row.id, {
    dirty,
    revert: () => {
      setPriceText(String(row.price));
      setQtyText(String(row.qty));
      setFormKey((key) => key + 1);
      setErr(null);
    },
    save: persist,
  });

  useEffect(() => {
    if (!editing) {
      setPriceText(String(row.price));
      setQtyText(String(row.qty));
    }
  }, [row.price, row.qty, editing]);

  async function remove() {
    if (removing) return;
    if (!confirm(`Remove ${row.label}?`)) return;
    setRemoving(true);
    try {
      const message = await removeShipmentLineById(row.customer_shipment_id, row.id);
      if (message) setErr(message);
      else router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <SelectableRow id={row.id}>
      <td className="w-[16%] min-w-0 break-words pr-2">
        <div className="font-medium leading-tight">{row.label}</div>
        <div className="mt-1 text-xs leading-tight font-light text-stone-500">{orderText(row)}</div>
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      <td className="w-full min-w-0 pr-1">
        <div className="flex items-center gap-3">
          <div
            className={editing || !editable ? undefined : "cursor-pointer"}
            title={editing || !editable ? undefined : "Double click to edit"}
            onDoubleClick={
              editing || !editable
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
              <form
                key={formKey}
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => e.preventDefault()}
              >
                {freight ? null : (
                  <label className="block text-sm">
                    <span className="mb-1 block text-stone-500">Qty</span>
                    <NumericInput
                      name="qty"
                      defaultValue={row.qty}
                      className="w-28 rounded border px-2 py-1"
                      aria-label="Quantity"
                      onChange={(e) => setQtyText(e.target.value)}
                    />
                  </label>
                )}
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-500">{freight ? "Cost" : "Price"}</span>
                  <PriceInput
                    name="price"
                    defaultValue={row.price}
                    className="w-28 rounded border px-2 py-1"
                    aria-label={freight ? "Cost" : "Price"}
                    onChange={(e) => setPriceText(e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                </label>
              </form>
            ) : freight ? (
              <span className="text-sm tabular-nums">{usd.format(row.price)}</span>
            ) : (
              <span className="text-sm tabular-nums">
                {row.qty} × {usd.format(row.price)}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="h-px w-52 pr-2 align-top">
        <div className="flex h-full min-h-14 flex-col justify-between gap-1 pt-1">
          <div className="min-w-36 [&>div]:flex-nowrap">
            {editable ? (
              <RowButtons
                editing={editing}
                dirty={dirty}
                saving={saving}
                deleting={removing}
                onEdit={requestEdit}
                onSave={() => void persist()}
                onCancel={requestCancel}
                onDelete={editing ? undefined : () => void remove()}
              />
            ) : null}
          </div>
          <div className="mt-1 flex justify-end">
            <span className={MONEY}>{usd.format(editing ? typed : lineAmount(row))}</span>
          </div>
        </div>
      </td>
    </SelectableRow>
  );
}
