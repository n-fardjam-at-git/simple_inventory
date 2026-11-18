"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PrintActions } from "@/components/print/PrintActions";
import { PrintDate } from "@/components/print/PrintDate";
import { SavePdfButton } from "@/components/print/SavePdfButton";
import { PRODUCT_TYPE } from "@/lib/product-type";
import { summarizeOrder } from "@/lib/order-summary";
import { isNoDropAxis, visibleDrops } from "@/lib/size-code";
import type { CustomerOrderReport, OrderReportCell, OrderReportLine } from "@/lib/customer-order-report";
import { cartKey, readCart } from "../cart";

export type PreviewProduct = {
  id: string;
  name: string;
  price: number;
  article: string | null;
  model: string | null;
  item: string | null;
  fabric: string | null;
  sizes: { id: string; code: string; sort_order: number }[];
  drops: { id: string; code: string; sort_order: number }[];
  upcharges: { size_id: string; drop_id: string; amount: number }[];
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function displayQty(n: number) {
  if (!Number.isFinite(n) || n === 0) return "";
  return String(Math.round(n));
}

function Box({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="print-box mt-2 rounded border border-stone-400">
      <div className="print-lot-head flex items-baseline justify-between gap-2 rounded-t border-b border-stone-400 px-2 py-0.5">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        {right}
      </div>
      <div className="px-2 pt-1 pb-2">{children}</div>
    </section>
  );
}

function MerchandiseLine({ line }: { line: OrderReportLine }) {
  const cellAt = (sizeId: string, dropId: string) =>
    line.cells.find((cell) => cell.size_id === sizeId && cell.drop_id === dropId) ?? null;
  const showGrid = line.sizes.length > 0 && line.cells.length > 0;
  const dropRows =
    line.hide_drop || isNoDropAxis(line.drops)
      ? [{ id: line.drops[0]?.id ?? "", code: "" }]
      : line.drops;
  const detail = [line.article, line.model, line.item].filter(Boolean).join(" · ");
  return (
    <Box title={line.name} right={<p className="text-sm font-semibold tabular-nums">{usd.format(line.price)}</p>}>
      {detail || line.fabric ? (
        <p className="mb-1 text-xs leading-tight text-stone-600">
          {detail}
          {line.fabric ? <span className="ml-2 font-light">{line.fabric}</span> : null}
        </p>
      ) : null}
      {showGrid ? (
        <table className="w-full table-fixed border-collapse text-center text-xs">
          <colgroup>
            {line.hide_drop ? null : <col className="w-[12%]" />}
            {line.sizes.map((size) => (
              <col key={size.id} />
            ))}
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr>
              {line.hide_drop ? null : (
                <th className="print-matrix-head border border-stone-300 px-1 py-0.5 text-left font-medium">
                  Drop
                </th>
              )}
              {line.sizes.map((size) => (
                <th
                  key={size.id}
                  className="print-matrix-head border border-stone-300 px-1 py-0.5 font-medium tabular-nums"
                >
                  {size.code}
                </th>
              ))}
              <th className="print-matrix-head border border-stone-300 px-1 py-0.5 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {dropRows.map((drop) => {
              const rowSum = line.sizes.reduce((sum, size) => sum + (cellAt(size.id, drop.id)?.qty ?? 0), 0);
              return (
                <tr key={drop.id || "none"}>
                  {line.hide_drop ? null : (
                    <th className="border border-stone-300 bg-white px-1 py-0.5 text-left font-medium">{drop.code}</th>
                  )}
                  {line.sizes.map((size) => {
                    const cell = cellAt(size.id, drop.id);
                    return (
                      <td key={size.id} className="border border-stone-300 px-1 py-0.5 align-top tabular-nums">
                        {displayQty(cell?.qty ?? 0)}
                        {cell && cell.qty > 0 && cell.extra > 0 ? (
                          <span className="block text-[9px] leading-tight text-amber-700">
                            +{cell.extra.toFixed(2)}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="border border-stone-300 px-1 py-0.5 font-medium tabular-nums">{displayQty(rowSum)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-stone-400">Not sized</p>
      )}
      <p className="mt-1 flex justify-end gap-4 text-xs tabular-nums">
        <span>
          <span className="text-stone-500">Total</span> {line.ordered}
        </span>
        <span className="font-semibold">
          <span className="font-normal text-stone-500">Extended</span> {usd.format(line.extended)}
        </span>
      </p>
    </Box>
  );
}

function linesFromCart(raw: string | null, products: PreviewProduct[]): OrderReportLine[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const cart = readCart(raw, new Set(products.map((product) => product.id)));
  const lines: OrderReportLine[] = [];
  for (const item of cart) {
    const product = byId.get(item.productId);
    if (!product) continue;
    const sizeIds = new Set(product.sizes.map((size) => size.id));
    const dropIds = new Set(product.drops.map((drop) => drop.id));
    const extras = new Map(product.upcharges.map((row) => [`${row.size_id}:${row.drop_id}`, row.amount]));
    const cells: OrderReportCell[] = item.cells
      .filter((cell) => sizeIds.has(cell.size_id) && dropIds.has(cell.drop_id) && Number(cell.qty) > 0)
      .map((cell) => ({
        size_id: cell.size_id,
        drop_id: cell.drop_id,
        qty: Math.round(Number(cell.qty)),
        qty_shipped: 0,
        extra: extras.get(`${cell.size_id}:${cell.drop_id}`) ?? 0,
      }));
    if (!cells.length) continue;
    const hideDrop = isNoDropAxis(product.drops);
    const used = new Set(cells.map((cell) => cell.drop_id));
    const drops = (hideDrop ? product.drops : visibleDrops(product.drops)).filter((drop) => used.has(drop.id));
    const ordered = cells.reduce((sum, cell) => sum + cell.qty, 0);
    const extended = cells.reduce((sum, cell) => sum + cell.qty * (product.price + cell.extra), 0);
    lines.push({
      product_id: product.id,
      type: PRODUCT_TYPE.merchandise,
      name: product.name,
      status: "",
      price: product.price,
      qty: null,
      lot_no: null,
      article: product.article,
      model: product.model,
      item: product.item,
      fabric: product.fabric,
      sizes: product.sizes,
      drops,
      hide_drop: hideDrop,
      cells,
      ordered,
      shipped: 0,
      extended,
      shipped_value: 0,
    });
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export function ShopPreview({
  customerId,
  customer,
  company,
  fileName,
  products,
}: {
  customerId: string;
  customer: string;
  company: string;
  fileName: string;
  products: PreviewProduct[];
}) {
  const [lines, setLines] = useState<OrderReportLine[] | null>(null);

  useEffect(() => {
    setLines(linesFromCart(window.localStorage.getItem(cartKey(customerId)), products));
  }, [customerId, products]);

  const report = useMemo<CustomerOrderReport | null>(() => {
    if (!lines) return null;
    const totals = summarizeOrder(lines);
    return {
      order_id: "",
      order_no: 0,
      status: "",
      company,
      customer,
      account_no: null,
      sage: null,
      terms: null,
      shipping_method: null,
      transmission_method: null,
      future_season: null,
      start_date: null,
      cancel_date: null,
      created_at: null,
      updated_at: null,
      sales_rep: null,
      created_by: null,
      updated_by: null,
      ship_to: [],
      bill_to: [],
      notes: null,
      merchandise: lines,
      charges: [],
      summary: { ...totals, products: lines.length, charge_qty: 0 },
    };
  }, [lines, company, customer]);

  if (!report) return null;

  const { summary } = report;
  const rule = "border-b border-stone-200";

  return (
    <>
      <PrintActions
        title={fileName}
        orderLabel="Preview"
        vendorLabel={customer}
        repeatPageHead
        marginPageNumbers
        autoPrint={false}
      >
        <SavePdfButton report={report} fileName={fileName} details={false} orderNumber={false} shipped={false} />
      </PrintActions>
      <div className="print-report print-report-tight bg-white text-stone-900">
        <div className="print-first-title mb-2">
          <p className="text-center text-xl font-semibold tracking-tight">{company}</p>
          <p className="text-right text-xs">
            <PrintDate />
          </p>
        </div>
        <table className="print-sheet print-sheet-whole w-full border-collapse">
          <thead>
            <tr>
              <td>
                <div className="print-page-head">
                  <span className="font-semibold">Preview</span>
                  <span>{customer}</span>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            {report.merchandise.length === 0 ? (
              <tr>
                <td>
                  <p className="mt-2 text-sm text-stone-500">The cart is empty.</p>
                </td>
              </tr>
            ) : (
              report.merchandise.map((line) => (
                <tr key={line.product_id}>
                  <td>
                    <MerchandiseLine line={line} />
                  </td>
                </tr>
              ))
            )}
            {report.merchandise.length === 0 ? null : (
              <tr>
                <td>
                  <Box title="Order summary">
                    <table className="ml-auto w-[60%] border-collapse text-xs">
                      <tbody>
                        {summary.items.map((row) => (
                          <tr key={row.item} className={rule}>
                            <td className="w-12 py-0.5 text-right tabular-nums">{row.units}</td>
                            <td className="py-0.5 pl-2">{row.item}</td>
                            <td className="py-0.5 text-right tabular-nums">{usd.format(row.amount)}</td>
                          </tr>
                        ))}
                        <tr className={`${rule} font-semibold`}>
                          <td className="w-12 py-0.5 text-right tabular-nums">{summary.units}</td>
                          <td className="py-0.5 pl-2">Total quantity</td>
                          <td className="py-0.5 text-right tabular-nums">{usd.format(summary.merchandise)}</td>
                        </tr>
                        <tr className={rule}>
                          <td />
                          <td className="py-0.5 pl-2">Surcharges</td>
                          <td className="py-0.5 text-right tabular-nums">{usd.format(summary.surcharge)}</td>
                        </tr>
                        <tr className={rule}>
                          <td />
                          <td className="py-0.5 pl-2">Freight</td>
                          <td className="py-0.5 text-right tabular-nums">{usd.format(summary.freight)}</td>
                        </tr>
                        <tr>
                          <td />
                          <th className="py-1 pl-2 text-left text-sm font-semibold">Grand total</th>
                          <td className="py-1 text-right text-sm font-semibold tabular-nums">
                            {usd.format(summary.total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Box>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
