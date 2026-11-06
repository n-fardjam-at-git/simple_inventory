import { cache, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { loadCustomerOrderReport, type OrderReportLine } from "@/lib/customer-order-report";
import { orderStatusLabel } from "@/lib/customer-order";
import { safeFileName } from "@/lib/file-name";
import { PRODUCT_TYPE, productTypeLabel } from "@/lib/product-type";
import { isNoDropAxis } from "@/lib/size-code";
import { PrintActions } from "@/components/print/PrintActions";
import { PrintDate } from "@/components/print/PrintDate";
import { SavePdfButton } from "@/components/print/SavePdfButton";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function displayQty(n: number) {
  if (!Number.isFinite(n) || n === 0) return "";
  return String(Math.round(n));
}

function displayDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${m}/${d}/${y}`;
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex gap-2 leading-tight">
      <span className="w-24 shrink-0 text-stone-500">{label}</span>
      <span>{value == null || value === "" ? "—" : value}</span>
    </div>
  );
}

/** One boxed group: gray title bar, then the body. Never splits across pages. */
function Box({
  title,
  right,
  children,
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
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

function AddressBlock({ title, name, lines }: { title: string; name: string; lines: string[] }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
        {title}
      </p>
      <p className="font-medium leading-tight">{name}</p>
      {lines.length ? (
        lines.map((line, i) => (
          <p key={i} className="leading-tight">
            {line}
          </p>
        ))
      ) : (
        <p className="leading-tight text-stone-400">No address</p>
      )}
    </div>
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
    <Box
      title={
        <>
          {line.name}
          <span className="ml-2 font-light text-stone-700">{orderStatusLabel(line.status)}</span>
        </>
      }
      right={<p className="text-sm font-semibold tabular-nums">{usd.format(line.price)}</p>}
    >
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
              <th className="print-matrix-head border border-stone-300 px-1 py-0.5 font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {dropRows.map((drop) => {
              const rowSum = line.sizes.reduce(
                (sum, size) => sum + (cellAt(size.id, drop.id)?.qty ?? 0),
                0,
              );
              return (
                <tr key={drop.id || "none"}>
                  {line.hide_drop ? null : (
                    <th className="border border-stone-300 bg-white px-1 py-0.5 text-left font-medium">
                      {drop.code}
                    </th>
                  )}
                  {line.sizes.map((size) => {
                    const cell = cellAt(size.id, drop.id);
                    return (
                      <td
                        key={size.id}
                        className="border border-stone-300 px-1 py-0.5 align-top tabular-nums"
                      >
                        {displayQty(cell?.qty ?? 0)}
                        {cell && cell.qty > 0 && cell.extra > 0 ? (
                          <span className="block text-[9px] leading-tight text-amber-700">
                            +{cell.extra.toFixed(2)}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="border border-stone-300 px-1 py-0.5 font-medium tabular-nums">
                    {displayQty(rowSum)}
                  </td>
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
        <span>
          <span className="text-stone-500">Shipped</span> {line.shipped}
        </span>
        <span className="font-semibold">
          <span className="font-normal text-stone-500">Extended</span> {usd.format(line.extended)}
        </span>
      </p>
    </Box>
  );
}

const loadReport = cache(loadCustomerOrderReport);

function reportFileName(report: { order_no: number; customer: string }) {
  return [`Order No ${report.order_no}`, safeFileName(report.customer)]
    .filter(Boolean)
    .join(" - ");
}

/** The page title is the default file name in Save as PDF. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const report = await loadReport(id);
  return { title: report ? reportFileName(report) : "Customer order" };
}

export default async function CustomerOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const report = await loadReport(id);
  if (!report) notFound();

  const { summary } = report;
  const fileName = reportFileName(report);
  const line = "border-b border-stone-200";

  return (
    <>
      <PrintActions
        title={fileName}
        orderLabel={`Order ${report.order_no}`}
        vendorLabel={report.customer}
        repeatPageHead
        marginPageNumbers
        autoPrint={false}
      >
        <SavePdfButton report={report} fileName={fileName} />
      </PrintActions>
      <div className="print-report print-report-tight bg-white text-stone-900">
        <div className="print-first-title mb-2">
          <p className="text-center text-xl font-semibold tracking-tight">{report.company}</p>
          <p className="text-right text-xs">
            <PrintDate />
          </p>
        </div>
        <table className="print-sheet print-sheet-whole w-full border-collapse">
          <thead>
            <tr>
              <td>
                <div className="print-page-head">
                  <span className="font-semibold tabular-nums">Order {report.order_no}</span>
                  <span>{report.customer}</span>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Box title="Order details">
                  <div className="grid grid-cols-2 gap-x-6 text-xs">
                    <div className="space-y-0.5">
                      <Field label="Customer" value={report.customer} />
                      <Field label="Terms" value={report.terms} />
                      <Field label="Shipping method" value={report.shipping_method} />
                      <Field label="Season" value={report.future_season} />
                    </div>
                    <div className="space-y-0.5">
                      <Field label="Status" value={orderStatusLabel(report.status)} />
                      <Field label="Start date" value={displayDate(report.start_date)} />
                      <Field label="Cancel date" value={displayDate(report.cancel_date)} />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 border-t border-stone-200 pt-1.5 text-xs">
                    <AddressBlock title="Ship to" name={report.customer} lines={report.ship_to} />
                    <AddressBlock title="Bill to" name={report.customer} lines={report.bill_to} />
                  </div>
                  {report.notes ? (
                    <p className="mt-2 border-t border-stone-200 pt-1.5 text-xs leading-tight">
                      <span className="text-stone-500">Notes</span> {report.notes}
                    </p>
                  ) : null}
                </Box>
              </td>
            </tr>
            {report.merchandise.length === 0 ? (
              <tr>
                <td>
                  <p className="mt-2 text-sm text-stone-500">No merchandise on this order.</p>
                </td>
              </tr>
            ) : (
              report.merchandise.map((merch) => (
                <tr key={merch.product_id}>
                  <td>
                    <MerchandiseLine line={merch} />
                  </td>
                </tr>
              ))
            )}
            {report.charges.length > 0 ? (
              <tr>
                <td>
                  <Box title="Charges">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="text-stone-500">
                          <th className="py-0.5 text-left font-medium">Charge</th>
                          <th className="py-0.5 text-left font-medium">Type</th>
                          <th className="py-0.5 text-left font-medium">Status</th>
                          <th className="w-[12%] py-0.5 text-right font-medium">Qty</th>
                          <th className="w-[16%] py-0.5 text-right font-medium">Price</th>
                          <th className="w-[16%] py-0.5 text-right font-medium">Extended</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.charges.map((charge) => (
                          <tr key={charge.product_id} className="border-t border-stone-200">
                            <td className="py-0.5">{charge.name}</td>
                            <td className="py-0.5">{productTypeLabel(charge.type)}</td>
                            <td className="py-0.5">{orderStatusLabel(charge.status)}</td>
                            <td className="py-0.5 text-right tabular-nums">
                              {charge.type === PRODUCT_TYPE.freight ? "" : charge.ordered}
                            </td>
                            <td className="py-0.5 text-right tabular-nums">
                              {usd.format(charge.price)}
                            </td>
                            <td className="py-0.5 text-right font-semibold tabular-nums">
                              {usd.format(charge.extended)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                </td>
              </tr>
            ) : null}
            <tr>
              <td>
                <Box title="Order summary">
                  <table className="ml-auto w-[60%] border-collapse text-xs">
                    <tbody>
                      {summary.items.map((row) => (
                        <tr key={row.item} className={line}>
                          <td className="w-12 py-0.5 text-right tabular-nums">{row.units}</td>
                          <td className="py-0.5 pl-2">{row.item}</td>
                          <td className="py-0.5 text-right tabular-nums">{usd.format(row.amount)}</td>
                        </tr>
                      ))}
                      <tr className={`${line} font-semibold`}>
                        <td className="w-12 py-0.5 text-right tabular-nums">{summary.units}</td>
                        <td className="py-0.5 pl-2">Total quantity</td>
                        <td className="py-0.5 text-right tabular-nums">
                          {usd.format(summary.merchandise)}
                        </td>
                      </tr>
                      <tr className={line}>
                        <td />
                        <td className="py-0.5 pl-2">Surcharges</td>
                        <td className="py-0.5 text-right tabular-nums">
                          {usd.format(summary.surcharge)}
                        </td>
                      </tr>
                      <tr className={line}>
                        <td />
                        <td className="py-0.5 pl-2">Freight</td>
                        <td className="py-0.5 text-right tabular-nums">
                          {usd.format(summary.freight)}
                        </td>
                      </tr>
                      <tr>
                        <td />
                        <th className="py-1 pl-2 text-left text-sm font-semibold">Grand total</th>
                        <td className="py-1 text-right text-sm font-semibold tabular-nums">
                          {usd.format(summary.total)}
                        </td>
                      </tr>
                      <tr className="border-t border-stone-300 text-stone-600">
                        <td className="w-12 pt-1 pb-0.5 text-right tabular-nums">
                          {summary.shipped_qty}
                        </td>
                        <td className="pt-1 pb-0.5 pl-2">Shipped</td>
                        <td className="pt-1 pb-0.5 text-right tabular-nums">
                          {usd.format(summary.shipped_value)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Box>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
