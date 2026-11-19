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
import { CuttingDropQtyGrid } from "../cutting-orders/CuttingDropQtyGrid";
import { PRODUCT_TYPE } from "@/lib/product-type";
import { summarizeOrder } from "@/lib/order-summary";
import { addRequestProduct, removeRequestProduct, saveRequestQty } from "./actions";
import { RequestSizesWindow } from "./RequestSizesWindow";
import type { RequestCatalogChoice, RequestLine, RequestSetItem } from "./types";

const ANY: RequestSetItem = { id: "any", name: "Any" };
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const MONEY =
  "inline-flex w-20 shrink-0 items-center justify-end overflow-hidden border border-stone-200 bg-stone-50 px-0.5 py-0 text-xs font-semibold tabular-nums";

type SizesTarget = {
  productId: string;
  label: string;
  anchor: HTMLElement | null;
  fromRow: boolean;
};

function lineExtended(line: RequestLine) {
  if (line.type !== PRODUCT_TYPE.merchandise) {
    const qty = line.type === PRODUCT_TYPE.freight ? 1 : Number(line.qty) || 0;
    return qty * (Number(line.price) || 0);
  }
  const price = Number(line.price) || 0;
  return line.cells.reduce((sum, cell) => sum + (Number(cell.qty) || 0) * (price + (Number(cell.upcharge) || 0)), 0);
}

export function RequestProductsPanel({
  open,
  onClose,
  requestId,
  requestNo,
  lines,
  draft,
  setItems,
  catalog,
}: {
  open: boolean;
  onClose: () => void;
  requestId: string | null;
  requestNo: number | null;
  lines: RequestLine[];
  draft: boolean;
  setItems: RequestSetItem[];
  catalog: RequestCatalogChoice[];
}) {
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  const [sizes, setSizes] = useState<SizesTarget | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPickItemId(null);
    setSizes(null);
  }, [open, requestId]);

  const onOrder = new Set(lines.map((line) => line.product_id));

  return (
    <DockedPanel
      open={open}
      onClose={onClose}
      title={requestNo != null ? `Order ${requestNo}` : "Order"}
      side="right"
      width="95%"
    >
      {open && requestId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {draft ? (
            <div className="mb-3 flex shrink-0 justify-center">
              <div ref={barRef} className="min-w-56 max-w-full rounded-lg border border-stone-300 bg-white">
                <div className="border-b border-stone-300 bg-stone-100 px-3 py-2 text-center text-sm font-medium text-stone-700">
                  Add a product
                </div>
                <div className="grid grid-flow-col auto-cols-fr">
                  {[ANY, ...setItems].map((item) => (
                    <ItemPickButton
                      key={item.id}
                      item={item}
                      open={pickItemId === item.id}
                      requestId={requestId}
                      options={catalog.filter(
                        (product) =>
                          !onOrder.has(product.id) && (item.id === "any" || product.item_id === item.id),
                      )}
                      sizeOptions={catalog.filter(
                        (product) => item.id === "any" || product.item_id === item.id,
                      )}
                      onToggle={() => setPickItemId((current) => (current === item.id ? null : item.id))}
                      onClose={() => setPickItemId(null)}
                      onShowSizes={(choice) => {
                        setSizes({
                          productId: choice.id,
                          label: choice.label,
                          anchor: barRef.current,
                          fromRow: false,
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <ProductTable
            lines={lines}
            draft={draft}
            sizes={sizes}
            onShowSizes={(line, anchor) =>
              setSizes({ productId: line.product_id, label: line.name, anchor, fromRow: true })
            }
            onCloseSizes={() => setSizes(null)}
          />
        </div>
      ) : null}
      {open && sizes ? (
        <RequestSizesWindow
          key={sizes.productId}
          productId={sizes.productId}
          label={sizes.label}
          anchor={sizes.anchor}
          onClose={() => setSizes(null)}
        />
      ) : null}
    </DockedPanel>
  );
}

function ItemPickButton({
  item,
  open,
  requestId,
  options,
  sizeOptions,
  onToggle,
  onClose,
  onShowSizes,
}: {
  item: RequestSetItem;
  open: boolean;
  requestId: string;
  options: RequestCatalogChoice[];
  sizeOptions: RequestCatalogChoice[];
  onToggle: () => void;
  onClose: () => void;
  onShowSizes: (choice: RequestCatalogChoice) => void;
}) {
  const [productId, setProductId] = useState("");
  const [sizesOn, setSizesOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const popRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const list = sizesOn ? sizeOptions : options;

  useEffect(() => {
    if (!open) {
      setProductId("");
      setSizesOn(false);
      setErr(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
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
  }, [open, sizesOn]);

  function showSizes() {
    if (reportInvalidCombo(popRef.current)) return;
    const choice = sizeOptions.find((product) => product.id === productId);
    if (!choice) {
      setErr("Pick a product.");
      return;
    }
    onShowSizes(choice);
  }

  function add() {
    if (reportInvalidCombo(popRef.current)) return;
    if (!productId) {
      setErr("Pick a product.");
      return;
    }
    start(async () => {
      const message = await addRequestProduct(requestId, productId);
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
        {item.name}
      </button>
      {open ? (
        <div
          ref={popRef}
          className="absolute top-full left-0 z-20 mt-1 w-72 max-h-[70vh] overflow-auto rounded-lg border border-stone-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span>Available sizes</span>
            <button
              type="button"
              role="switch"
              aria-checked={sizesOn}
              aria-label="Available sizes"
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                sizesOn ? "bg-[#34C759]" : "bg-stone-300"
              }`}
              onClick={() => {
                setSizesOn((on) => {
                  const next = !on;
                  if (!next && productId && !options.some((product) => product.id === productId)) {
                    setProductId("");
                  }
                  return next;
                });
                setErr(null);
              }}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  sizesOn ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <label className="mb-2 block text-sm">
            <span className="mb-1 block text-stone-500">Product</span>
            <ComboBox
              key={`${item.id}-${sizesOn ? "sizes" : "add"}`}
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
          {err ? (
            <DismissNote className="mb-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <div className="flex gap-2">
            {sizesOn ? (
              <Btn type="button" onClick={showSizes}>
                Available sizes
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

function ProductTable({
  lines,
  draft,
  sizes,
  onShowSizes,
  onCloseSizes,
}: {
  lines: RequestLine[];
  draft: boolean;
  sizes: SizesTarget | null;
  onShowSizes: (line: RequestLine, anchor: HTMLElement | null) => void;
  onCloseSizes: () => void;
}) {
  const items = [...lines].sort((a, b) => {
    if (a.type !== b.type) return a.type - b.type;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FitList
        items={items}
        getKey={(line) => line.product_id}
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
        renderRow={(line) =>
          line.type === PRODUCT_TYPE.merchandise ? (
            <MerchandiseRow
              line={line}
              draft={draft}
              sizesOpen={sizes?.fromRow === true && sizes.productId === line.product_id}
              onShowSizes={onShowSizes}
              onCloseSizes={onCloseSizes}
            />
          ) : (
            <ChargeRow line={line} />
          )
        }
      />
      <Totals lines={lines} />
    </div>
  );
}

function Totals({ lines }: { lines: RequestLine[] }) {
  const { freight, surcharge, merchandise, total } = summarizeOrder(
    lines.map((line) => ({
      type: line.type,
      status: "pending",
      item: null,
      ordered:
        line.type === PRODUCT_TYPE.merchandise
          ? line.cells.reduce((sum, cell) => sum + (Number(cell.qty) || 0), 0)
          : line.type === PRODUCT_TYPE.freight
            ? 1
            : Number(line.qty) || 0,
      extended: lineExtended(line),
      shipped: 0,
      shipped_value: 0,
    })),
  );
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

function MerchandiseRow({
  line,
  draft,
  sizesOpen,
  onShowSizes,
  onCloseSizes,
}: {
  line: RequestLine;
  draft: boolean;
  sizesOpen: boolean;
  onShowSizes: (line: RequestLine, anchor: HTMLElement | null) => void;
  onCloseSizes: () => void;
}) {
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [extended, setExtended] = useState(() => lineExtended(line));
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const sizeBtn = useRef<HTMLButtonElement>(null);
  const armed = useRef(false);
  const list = useList();
  const router = useRouter();
  const refreshRow = useRefreshRow(line);

  function persist() {
    return new Promise<boolean>((resolve) => {
      if (busy.current) {
        resolve(false);
        return;
      }
      const form = formRef.current;
      busy.current = true;
      setSaving(true);
      void (async () => {
        try {
          const message = await saveRequestQty(line.request_id, line.product_id, form ? new FormData(form) : new FormData());
          if (message) {
            setErr(message);
            resolve(false);
            return;
          }
          setErr(null);
          await refreshRow();
          setMatrixDirty(false);
          list.finishEdit(line.product_id);
          resolve(true);
        } finally {
          busy.current = false;
          setSaving(false);
        }
      })();
    });
  }

  const { editing, requestEdit, requestCancel } = useListRow(line.product_id, {
    dirty: matrixDirty,
    revert: () => {
      setMatrixDirty(false);
      setFormKey((key) => key + 1);
      setErr(null);
    },
    save: persist,
  });

  useEffect(() => {
    if (!sizesOpen) {
      armed.current = false;
      return;
    }
    if (list.selectedId === line.product_id) {
      armed.current = true;
      return;
    }
    if (armed.current) onCloseSizes();
  }, [sizesOpen, list.selectedId, line.product_id, onCloseSizes]);

  function toggleSizes() {
    if (sizesOpen) {
      onCloseSizes();
      return;
    }
    if (list.selectedId !== line.product_id) list.requestSelect(line.product_id);
    onShowSizes(line, sizeBtn.current?.closest("tr") ?? null);
  }

  return (
    <SelectableRow id={line.product_id} keepSelected={sizesOpen}>
      <td className="w-[16%] min-w-0 break-words pr-2">
        <div className="flex flex-wrap items-center gap-1 font-medium leading-tight">
          <span>{line.name}</span>
          <span className="font-light text-stone-500">${Number(line.price).toFixed(2)}</span>
        </div>
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      <td className="w-full min-w-0 pr-1">
        {draft && editing ? (
          <form
            key={formKey}
            ref={formRef}
            className="min-w-0 w-full"
            onInput={() => setMatrixDirty(true)}
            onSubmit={(event) => {
              event.preventDefault();
              void persist();
            }}
          >
            <CuttingDropQtyGrid
              sizes={line.sizes}
              drops={line.drops}
              cells={line.cells}
              editable
              qtyOnly
              namePrefix="ord"
              linePrice={line.price}
              onExtendedChange={setExtended}
              onDirty={() => setMatrixDirty(true)}
            />
          </form>
        ) : (
          <div
            className={draft ? "cursor-pointer" : undefined}
            title={draft ? "Double click to edit" : undefined}
            onDoubleClick={
              draft
                ? (event) => {
                    event.stopPropagation();
                    requestEdit();
                  }
                : undefined
            }
          >
            <CuttingDropQtyGrid
              qtyOnly
              linePrice={line.price}
              onExtendedChange={setExtended}
              sizes={line.sizes}
              drops={line.drops}
              cells={line.cells}
            />
          </div>
        )}
      </td>
      <td className="h-px w-52 pr-2 align-top">
        <div className="flex h-full flex-col justify-between gap-1 pt-1">
          <div className="min-w-36">
            {draft ? (
              <RowButtons
                editing={editing}
                dirty={matrixDirty}
                saving={saving}
                deleting={pending}
                before={
                  <button
                    ref={sizeBtn}
                    type="button"
                    className={`text-xs underline ${sizesOpen ? "font-medium text-teal-800" : "text-stone-700"}`}
                    onClick={toggleSizes}
                  >
                    Available sizes
                  </button>
                }
                onEdit={requestEdit}
                onSave={() => void persist()}
                onCancel={requestCancel}
                onDelete={
                  editing
                    ? undefined
                    : () => {
                        if (!confirm(`Remove ${line.name}?`)) return;
                        start(async () => {
                          const message = await removeRequestProduct(line.request_id, line.product_id);
                          if (message) setErr(message);
                          else router.refresh();
                        });
                      }
                }
              />
            ) : (
              <button
                ref={sizeBtn}
                type="button"
                className={`text-xs underline ${sizesOpen ? "font-medium text-teal-800" : "text-stone-700"}`}
                onClick={toggleSizes}
              >
                Available sizes
              </button>
            )}
          </div>
          <div className="mt-1 flex justify-end">
            <span className={MONEY}>{usd.format(extended)}</span>
          </div>
        </div>
      </td>
    </SelectableRow>
  );
}

function ChargeRow({ line }: { line: RequestLine }) {
  const freight = line.type === PRODUCT_TYPE.freight;
  const qty = freight ? 1 : Number(line.qty) || 0;
  return (
    <SelectableRow id={line.product_id}>
      <td className="w-[16%] min-w-0 break-words pr-2">
        <div className="font-medium leading-tight">{line.name}</div>
        <p className="text-xs font-light text-stone-500">${Number(line.price).toFixed(2)}</p>
      </td>
      <td className="min-w-0 pr-1 text-sm tabular-nums">
        {freight ? usd.format(Number(line.price) || 0) : `${qty} × ${usd.format(Number(line.price) || 0)}`}
      </td>
      <td className="w-52 pr-2 align-bottom">
        <div className="flex justify-end">
          <span className={MONEY}>{usd.format(lineExtended(line))}</span>
        </div>
      </td>
    </SelectableRow>
  );
}
