import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { loadCustomerOrderReport, type OrderReportLine } from "@/lib/customer-order-report";
import { orderStatusLabel } from "@/lib/customer-order";
import { PRODUCT_TYPE, productTypeLabel } from "@/lib/product-type";
import { isNoDropAxis } from "@/lib/size-code";
import { PrintActions } from "@/components/print/PrintActions";

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
      <span className="w-28 shrink-0 text-stone-500">{label}</span>
      <span>{value == null || value === "" ? "—" : value}</span>
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
    <section data-lot-id={line.product_id} className="print-lot mt-2 rounded border border-stone-400">
      <div className="print-lot-head flex items-baseline justify-between gap-2 border-b border-stone-400 px-2 py-0.5">
        <p className="text-sm font-semibold leading-tight">
          {line.name}
          <span className="ml-2 font-light text-stone-700">{orderStatusLabel(line.status)}</span>
        </p>
        <p className="text-sm font-semibold tabular-nums">{usd.format(line.price)}</p>
      </div>
      <table className="print-lot-cont print-lot-quiet w-full border-collapse">
        <thead>
          <tr>
            <td className="print-lot-cont-head" />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-2 pt-1 pb-2 break-inside-avoid">
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
                  <span className="font-normal text-stone-500">Extended</span>{" "}
                  {usd.format(line.extended)}
                </span>
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export default async function CustomerOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const report = await loadCustomerOrderReport(id);
  if (!report) notFound();

  const summaryRows: [string, string][] = [
    ["Merchandise products", String(report.summary.products)],
    ["Merchandise units", String(report.summary.units)],
    ["Merchandise amount", usd.format(report.summary.merchandise)],
    ["Surcharge quantity", String(report.summary.charge_qty)],
    ["Surcharge", usd.format(report.summary.surcharge)],
    ["Freight", usd.format(report.summary.freight)],
    ["Shipped quantity", String(report.summary.shipped_qty)],
    ["Shipped value", usd.format(report.summary.shipped_value)],
  ];

  return (
    <>
      <PrintActions
        title={`Order ${report.order_no}${report.customer ? ` · ${report.customer}` : ""}`}
        orderLabel={`Order ${report.order_no}`}
        vendorLabel={report.customer}
        repeatPageHead
      />
      <div className="print-report print-report-tight bg-white text-stone-900">
        <p className="print-first-title mb-2 text-center text-xl font-semibold tracking-tight">
          {report.company}
        </p>
        <table className="print-sheet w-full border-collapse">
          <thead>
            <tr>
              <td>
                <div className="print-page-head">
                  <span className="font-semibold tabular-nums">Order {report.order_no}</span>
                  <span>{report.customer}</span>
                  <span className="print-page-n tabular-nums" />
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="print-meta mb-2 border-b border-stone-300 pb-2 text-xs">
                  <div className="space-y-0.5">
                    <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                      Order information
                    </p>
                    <Field label="Customer" value={report.customer} />
                    <Field label="Terms" value={report.terms} />
                    <Field label="Shipping method" value={report.shipping_method} />
                    <Field label="Season" value={report.future_season} />
                    <Field label="Status" value={orderStatusLabel(report.status)} />
                    <Field label="Start date" value={displayDate(report.start_date)} />
                    <Field label="Cancel date" value={displayDate(report.cancel_date)} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-6">
                    <div>
                      <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                        Ship to
                      </p>
                      <p className="font-medium leading-tight">{report.customer}</p>
                      {report.ship_to.length ? (
                        report.ship_to.map((line, i) => (
                          <p key={i} className="leading-tight">
                            {line}
                          </p>
                        ))
                      ) : (
                        <p className="leading-tight text-stone-400">No address</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                        Bill to
                      </p>
                      <p className="font-medium leading-tight">{report.customer}</p>
                      {report.bill_to.length ? (
                        report.bill_to.map((line, i) => (
                          <p key={i} className="leading-tight">
                            {line}
                          </p>
                        ))
                      ) : (
                        <p className="leading-tight text-stone-400">No address</p>
                      )}
                    </div>
                  </div>
                  {report.notes ? (
                    <p className="mt-2 leading-tight">
                      <span className="text-stone-500">Notes</span> {report.notes}
                    </p>
                  ) : null}
                </div>
              </td>
            </tr>
            {report.merchandise.length === 0 ? (
              <tr>
                <td>
                  <p className="print-lot text-sm text-stone-500">No merchandise on this order.</p>
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
            {report.charges.length > 0 ? (
              <tr>
                <td>
                  <section data-lot-id="charges" className="print-lot mt-2 rounded border border-stone-400">
                    <div className="print-lot-head border-b border-stone-400 px-2 py-0.5">
                      <p className="text-sm font-semibold leading-tight">Charges</p>
                    </div>
                    <table className="print-lot-cont print-lot-quiet w-full border-collapse">
                      <thead>
                        <tr>
                          <td className="print-lot-cont-head" />
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-2 pt-1 pb-1 break-inside-avoid">
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
                                {report.charges.map((line) => (
                                  <tr key={line.product_id} className="border-t border-stone-200">
                                    <td className="py-0.5">{line.name}</td>
                                    <td className="py-0.5">{productTypeLabel(line.type)}</td>
                                    <td className="py-0.5">{orderStatusLabel(line.status)}</td>
                                    <td className="py-0.5 text-right tabular-nums">
                                      {line.type === PRODUCT_TYPE.freight ? "" : line.ordered}
                                    </td>
                                    <td className="py-0.5 text-right tabular-nums">
                                      {usd.format(line.price)}
                                    </td>
                                    <td className="py-0.5 text-right font-semibold tabular-nums">
                                      {usd.format(line.extended)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>
                </td>
              </tr>
            ) : null}
            <tr>
              <td>
                <section data-lot-id="summary" className="print-lot mt-2 rounded border border-stone-400">
                  <div className="print-lot-head border-b border-stone-400 px-2 py-0.5">
                    <p className="text-sm font-semibold leading-tight">Order summary</p>
                  </div>
                  <table className="print-lot-cont print-lot-quiet w-full border-collapse">
                    <thead>
                      <tr>
                        <td className="print-lot-cont-head" />
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-2 pt-1 pb-1 break-inside-avoid">
                          <table className="ml-auto w-[55%] border-collapse text-xs">
                            <tbody>
                              {summaryRows.map(([label, value]) => (
                                <tr key={label} className="border-b border-stone-200">
                                  <td className="py-0.5 text-stone-600">{label}</td>
                                  <td className="py-0.5 text-right tabular-nums">{value}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <th className="py-1 text-left text-sm font-semibold">Grand total</th>
                                <td className="py-1 text-right text-sm font-semibold tabular-nums">
                                  {usd.format(report.summary.total)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
