"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Busy } from "@/components/WorkingBeside";
import { Btn } from "@/components/ui";
import { toSentenceCase } from "@/lib/text-case";
import { DockedPanel } from "@/components/filter/DockedPanel";
import { FitList } from "@/components/list/FitList";
import { SelectableRow } from "@/components/list/ListTable";
import { NumericInput } from "@/components/NumericInput";
import { CuttingDropQtyGrid } from "./CuttingDropQtyGrid";
import type { CuttingOrderProductRow } from "./CuttingOrderProductsTable";
import {
  applySizeDropScale,
  createSizeDropScaleFromLine,
  listSizeDropScales,
  deleteSizeDropScale,
  updateSizeDropScaleFromLine,
  type SizeDropScale,
} from "./scale-actions";

function lineLabel(row: CuttingOrderProductRow) {
  return row.products?.models?.name?.trim() || row.products?.name?.trim() || "Product";
}

function brandItemLabel(row: CuttingOrderProductRow) {
  const brand = row.products?.lots?.brands?.name?.trim();
  const item = row.products?.models?.items?.name?.trim();
  return [brand, item].filter(Boolean).join(" • ");
}

function defaultDistribute(row: CuttingOrderProductRow) {
  if (row.bulk_order_qty != null) return String(row.bulk_order_qty);
  const sized = row.cells.reduce((s, c) => s + Number(c.qty ?? 0), 0);
  return sized > 0 ? String(sized) : "";
}

function pctCells(scale: SizeDropScale) {
  return scale.cells
    .filter((c) => c.percent > 0)
    .map((c) => ({
      size_id: c.size_id,
      drop_id: c.drop_id,
      qty: Math.round(c.percent * 10) / 10,
    }));
}

export function ScalePanel({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: CuttingOrderProductRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scales, setScales] = useState<SizeDropScale[]>([]);
  const [qtyById, setQtyById] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const [job, setJob] = useState<string | null>(null);
  const [confirmApply, setConfirmApply] = useState<{ scaleId: string; qty: number } | null>(
    null,
  );
  const brandId = product?.brand_id ?? "";
  const itemId = product?.item_id ?? "";
  const chartId = product?.size_chart_id ?? "";
  const lineKey = product ? `${product.cutting_order_id}:${product.product_id}` : "";
  const canSample = Boolean(
    product?.cells.some((c) => Number(c.qty ?? 0) > 0),
  );

  useEffect(() => {
    if (!open || !product) {
      setName("");
      setScales([]);
      setQtyById({});
      setErr(null);
      setConfirmApply(null);
      return;
    }
    const seed = defaultDistribute(product);
    setName("");
    setErr(null);
    start(async () => {
      const result = await listSizeDropScales(brandId, itemId, chartId);
      if ("error" in result) {
        setErr(result.error);
        setScales([]);
        return;
      }
      setScales(result);
      setQtyById(Object.fromEntries(result.map((s) => [s.id, seed])));
    });
  }, [open, lineKey, brandId, itemId, chartId]);

  useEffect(() => {
    if (!confirmApply) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setConfirmApply(null);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [confirmApply]);

  async function reloadScales(keepQty = true) {
    if (!product) return;
    const result = await listSizeDropScales(brandId, itemId, chartId);
    if ("error" in result) {
      setErr(result.error);
      return;
    }
    const seed = defaultDistribute(product);
    setScales(result);
    setQtyById((cur) => {
      if (!keepQty) return Object.fromEntries(result.map((s) => [s.id, seed]));
      const next = { ...cur };
      for (const s of result) if (next[s.id] == null) next[s.id] = seed;
      return next;
    });
  }

  function add() {
    if (!product || !canSample) return;
    setJob("add");
    start(async () => {
      try {
        const message = await createSizeDropScaleFromLine(
          product.cutting_order_id,
          product.product_id,
          name,
        );
        if (message) {
          setErr(message);
          return;
        }
        setName("");
        setErr(null);
        await reloadScales();
      } finally {
        setJob(null);
      }
    });
  }

  function remove(scale: SizeDropScale) {
    if (!confirm(`Remove ${scale.name}?`)) return;
    setJob(`delete:${scale.id}`);
    start(async () => {
      try {
        const message = await deleteSizeDropScale(scale.id);
        if (message) {
          setErr(message);
          return;
        }
        setErr(null);
        setQtyById((cur) => {
          const next = { ...cur };
          delete next[scale.id];
          return next;
        });
        await reloadScales();
      } finally {
        setJob(null);
      }
    });
  }

  function update(scaleId: string) {
    if (!product || !canSample) return;
    setJob(`update:${scaleId}`);
    start(async () => {
      try {
        const message = await updateSizeDropScaleFromLine(
          product.cutting_order_id,
          product.product_id,
          scaleId,
        );
        if (message) {
          setErr(message);
          return;
        }
        setErr(null);
        await reloadScales();
      } finally {
        setJob(null);
      }
    });
  }

  function apply(scaleId: string) {
    if (!product) return;
    const raw = (qtyById[scaleId] ?? "").trim();
    const qty = raw === "" ? NaN : Number(raw);
    if (!Number.isInteger(qty) || qty < 0) {
      setErr("Enter a whole qty to distribute.");
      return;
    }
    if (canSample) {
      setConfirmApply({ scaleId, qty });
      return;
    }
    runApply(scaleId, qty, "replace", "apply");
  }

  function runApply(
    scaleId: string,
    qty: number,
    mode: "replace" | "combine",
    source: "apply" | "replace" | "combine",
  ) {
    if (!product) return;
    setConfirmApply(null);
    setJob(source === "apply" ? `apply:${scaleId}` : source);
    start(async () => {
      try {
        const message = await applySizeDropScale(
          product.cutting_order_id,
          product.product_id,
          scaleId,
          qty,
          mode,
        );
        if (message) {
          setErr(message);
          return;
        }
        setErr(null);
        router.refresh();
        onClose();
      } finally {
        setJob(null);
      }
    });
  }

  return (
    <DockedPanel
      open={open}
      onClose={onClose}
      title={product ? `Scale • ${lineLabel(product)}` : "Scale"}
      subtitle={product ? brandItemLabel(product) : undefined}
      side="right"
      width="55%"
      nested
    >
      {open && product ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {!brandId || !itemId || !chartId ? (
            <p className="text-sm text-stone-500">This product needs a brand, item, and size chart.</p>
          ) : (
            <>
              {canSample ? (
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setName((cur) => toSentenceCase(cur.trim()))}
                    placeholder="Name to add"
                    aria-label="Name to add"
                    className="min-w-0 flex-1 rounded border px-2 py-1"
                  />
                  <Btn type="button" busy={job === "add"} onClick={add}>
                    Add
                  </Btn>
                </div>
              ) : null}
              {err ? (
                <DismissNote className="shrink-0 text-xs text-red-700" onDismiss={() => setErr(null)}>
                  {err}
                </DismissNote>
              ) : null}
              <FitList
                items={scales}
                getKey={(s) => s.id}
                stretch
                tableClassName="inventory-boards table-fixed"
                thead={
                  <thead>
                    <tr className="text-stone-500">
                      <th className="w-36 py-1">Scale</th>
                      <th className="w-24 py-1">Qty</th>
                      <th className="w-full py-1"></th>
                      <th className="w-36 py-1"></th>
                    </tr>
                  </thead>
                }
                renderRow={(s) => (
                  <SelectableRow id={s.id}>
                    <td className="w-36 pr-2">
                      <div className="font-medium leading-tight">{s.name}</div>
                      {s.last_updated ? (
                        <p className="text-xs font-light tabular-nums leading-tight text-stone-500">
                          {s.last_updated}
                        </p>
                      ) : null}
                    </td>
                    <td className="w-24 pr-2">
                      <NumericInput
                        className="h-6 w-20 rounded border border-stone-300 bg-white px-1 text-center text-xs"
                        inputMode="numeric"
                        aria-label={`Qty to distribute for ${s.name}`}
                        value={qtyById[s.id] ?? ""}
                        onChange={(e) =>
                          setQtyById((cur) => ({ ...cur, [s.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="min-w-0 pr-1">
                      <CuttingDropQtyGrid
                        sizes={product.sizes}
                        drops={product.drops}
                        cells={pctCells(s)}
                      />
                    </td>
                    <td className="w-36 whitespace-nowrap py-1 pr-2">
                      <div className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
                        {canSample ? (
                          <Busy on={job === `update:${s.id}`}>
                            <button
                              type="button"
                              className="text-xs text-stone-700 underline disabled:opacity-50"
                              disabled={job != null}
                              onClick={() => update(s.id)}
                            >
                              Update
                            </button>
                          </Busy>
                        ) : null}
                        <Busy on={job === `apply:${s.id}`}>
                          <button
                            type="button"
                            className="text-xs font-medium text-teal-800 underline disabled:opacity-50"
                            disabled={job != null}
                            onClick={() => apply(s.id)}
                          >
                            Apply
                          </button>
                        </Busy>
                        <Busy on={job === `delete:${s.id}`}>
                          <button
                            type="button"
                            className="text-xs text-red-700 underline disabled:opacity-50"
                            disabled={job != null}
                            onClick={() => remove(s)}
                          >
                            Delete
                          </button>
                        </Busy>
                      </div>
                    </td>
                  </SelectableRow>
                )}
              />
            </>
          )}
        </div>
      ) : null}
      {confirmApply ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div
            className="max-w-sm rounded-lg bg-white p-4 shadow-lg"
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              e.preventDefault();
              e.stopPropagation();
              setConfirmApply(null);
            }}
          >
            <p className="mb-4 text-sm">This product is already sized</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Busy on={job === "replace"}>
                <button
                  type="button"
                  className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                  disabled={job != null}
                  onClick={() => runApply(confirmApply.scaleId, confirmApply.qty, "replace", "replace")}
                >
                  Replace
                </button>
              </Busy>
              <Busy on={job === "combine"}>
                <button
                  type="button"
                  className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                  disabled={job != null}
                  onClick={() => runApply(confirmApply.scaleId, confirmApply.qty, "combine", "combine")}
                >
                  Combine
                </button>
              </Busy>
              <button
                type="button"
                autoFocus
                className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800"
                disabled={job != null}
                onClick={() => setConfirmApply(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DockedPanel>
  );
}
