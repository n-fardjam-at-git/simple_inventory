"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DockedPanel } from "@/components/filter/DockedPanel";
import { Btn } from "@/components/ui";
import { ComboBox, reportInvalidCombo } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { useRefreshRow } from "@/components/list/useRefreshRow";
import { UpchargeMatrix, type Cell, type MatrixDrop, type MatrixSize } from "@/components/matrix/QtyMatrix";
import { PriceInput } from "@/components/PriceInput";
import { CuttingDropQtyGrid } from "../cutting-orders/CuttingDropQtyGrid";
import { LINE_STATUS, orderStatusLabel } from "@/lib/customer-order";
import {
  addCustomerOrderProductId,
  loadOrderProductDraft,
  removeCustomerOrderProductId,
  saveCustomerOrderQty,
  type OrderProductDraft,
} from "./actions";

export type OrderProductLine = {
  customer_order_id: string;
  product_id: string;
  status: string;
  price: number;
  label: string;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};

export type CatalogChoice = { id: string; label: string; item_id: string | null };
export type SetItem = { id: string; name: string };

const ANY: SetItem = { id: "any", name: "Any" };

export function OrderProductsPanel({
  open,
  onClose,
  orderId,
  orderNo,
  lines,
  setItems,
  catalog,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  orderNo: number | null;
  lines: OrderProductLine[];
  setItems: SetItem[];
  catalog: CatalogChoice[];
}) {
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  const onOrder = new Set(lines.map((line) => line.product_id));
  const choices = catalog.filter((product) => !onOrder.has(product.id));

  useEffect(() => {
    if (!open) setPickItemId(null);
  }, [open, orderId]);

  return (
    <DockedPanel
      open={open}
      onClose={onClose}
      title={orderNo != null ? String(orderNo) : "Order"}
      side="right"
      width="95%"
    >
      {open && orderId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex shrink-0 justify-center">
            <div className="min-w-56 max-w-full rounded-lg border border-stone-300 bg-white">
              <div className="border-b border-stone-300 bg-stone-100 px-3 py-2 text-center text-sm font-medium text-stone-700">
                Add a product
              </div>
              <div className="grid grid-flow-col auto-cols-fr">
                {[ANY, ...setItems].map((item) => (
                  <ItemPickButton
                    key={item.id}
                    item={item}
                    open={pickItemId === item.id}
                    orderId={orderId}
                    options={choices.filter(
                      (product) => item.id === "any" || product.item_id === item.id,
                    )}
                    onToggle={() => setPickItemId((cur) => (cur === item.id ? null : item.id))}
                    onClose={() => setPickItemId(null)}
                  />
                ))}
              </div>
            </div>
          </div>
          <OrderProductTable rows={lines} />
        </div>
      ) : null}
    </DockedPanel>
  );
}

function ItemPickButton({
  item,
  open,
  orderId,
  options,
  onToggle,
  onClose,
}: {
  item: SetItem;
  open: boolean;
  orderId: string;
  options: CatalogChoice[];
  onToggle: () => void;
  onClose: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [draft, setDraft] = useState<OrderProductDraft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const popRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) {
      setProductId("");
      setDraft(null);
      setErr(null);
    }
  }, [open]);

  useEffect(() => {
    if (!productId) {
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
  }, [productId]);

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
  }, [open, draft]);

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
              options={options.map((product) => ({ id: product.id, label: product.label }))}
            />
          </label>
          {draft ? (
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

function OrderProductTable({ rows }: { rows: OrderProductLine[] }) {
  const items = [...rows].sort((a, b) =>
    a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
  );
  return (
    <FitList
      items={items}
      getKey={(row) => `${row.customer_order_id}:${row.product_id}`}
      stretch
      tableClassName="inventory-boards table-fixed"
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="w-52 py-1">Product</th>
            <th className="w-full py-1"></th>
            <th className="w-32 py-1"></th>
          </tr>
        </thead>
      }
      renderRow={(row) => <ProductLineRow row={row} />}
    />
  );
}

function ProductLineRow({ row }: { row: OrderProductLine }) {
  const [status, setStatus] = useState(row.status);
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const list = useList();
  const router = useRouter();
  const refreshRow = useRefreshRow(row);
  const id = `${row.customer_order_id}:${row.product_id}`;
  const dirty = status !== row.status || matrixDirty;

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
    if (!editing) setStatus(row.status);
  }, [row.status, editing]);

  return (
    <SelectableRow id={id}>
      <td className="w-52 pr-2">
        <div className="font-medium leading-tight">
          {row.label}
          <span className="ml-1.5 font-light text-stone-500">${Number(row.price).toFixed(2)}</span>
        </div>
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
              onDirty={() => setMatrixDirty(true)}
            />
          </form>
        ) : (
          <CuttingDropQtyGrid qtyOnly sizes={row.sizes} drops={row.drops} cells={row.cells} />
        )}
      </td>
      <td className="w-32 whitespace-nowrap py-1 pr-2">
        <div className="flex justify-end">
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
      </td>
    </SelectableRow>
  );
}
