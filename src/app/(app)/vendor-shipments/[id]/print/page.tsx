import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { loadVendorShipmentReport } from "@/lib/vendor-shipment-report";
import { isNoDropAxis } from "@/lib/size-code";
import { PrintActions } from "@/components/print/PrintActions";

function displayQty(n: number) {
  if (!Number.isFinite(n) || n === 0) return "";
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function displayTotal(n: number) {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function lineTitle(name: string, orderNum: number) {
  return `${name}  Cutting ${orderNum}`;
}

export default async function VendorShipmentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRoles(["admin", "warehouse"]);
  const report = await loadVendorShipmentReport(id);
  if (!report) notFound();

  return (
    <>
      <PrintActions
        title={`Shipment ${report.shipment_num}${report.vendor ? ` · ${report.vendor}` : ""}`}
        orderLabel={`Shipment ${report.shipment_num}`}
        vendorLabel={`From ${report.vendor ?? "—"}`}
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
                  <span className="font-semibold tabular-nums">
                    Shipment {report.shipment_num}
                  </span>
                  <span>From {report.vendor ?? "—"}</span>
                  <span className="print-page-n tabular-nums" />
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="print-meta mb-2 border-b border-stone-300 pb-1 text-sm text-stone-600">
                  {report.received_date ? (
                    <span className="tabular-nums">Received {report.received_date}</span>
                  ) : null}
                  {report.air_way_no ? (
                    <span className="ml-3">Air way {report.air_way_no}</span>
                  ) : null}
                  <span className="ml-3">{report.posted ? "Posted" : "Open"}</span>
                </div>
              </td>
            </tr>
            {report.lines.length === 0 ? (
              <tr>
                <td>
                  <p className="print-lot text-sm text-stone-500">
                    No products on this shipment.
                  </p>
                </td>
              </tr>
            ) : (
              report.lines.map((p) => {
            const title = lineTitle(p.name, p.order_num);
            const qtyAt = (sizeId: string, dropId: string) =>
              p.cells.find((c) => c.size_id === sizeId && c.drop_id === dropId)?.qty ?? 0;
            const showGrid = p.sizes.length > 0 && p.cells.length > 0;
            const dropRows =
              p.hide_drop || isNoDropAxis(p.drops)
                ? [{ id: p.drops[0]?.id ?? "", code: "" }]
                : p.drops;
            return (
              <tr key={p.line_id}>
              <td>
              <section
                data-lot-id={p.line_id}
                className="print-lot mt-2 rounded border border-stone-400"
              >
                <div className="print-lot-head border-b border-stone-400 px-2 py-0.5">
                  <p className="text-sm font-semibold leading-tight">
                    {p.name}
                    <span className="ml-2 font-normal tabular-nums text-stone-700">
                      Cutting {p.order_num}
                    </span>
                  </p>
                </div>
                <table className="print-lot-cont w-full border-collapse">
                  <thead>
                    <tr>
                      <td className="print-lot-cont-head px-3">
                        <p className="text-xs font-light text-stone-500">{title}</p>
                      </td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 break-inside-avoid py-1">
                        {showGrid ? (
                          <div className="w-full">
                            <table className="w-full table-fixed border-collapse text-center text-xs">
                              <colgroup>
                                {p.hide_drop ? null : <col className="w-[12%]" />}
                                {p.sizes.map((s) => (
                                  <col key={s.id} />
                                ))}
                                <col className="w-[10%]" />
                              </colgroup>
                              <thead>
                                <tr>
                                  {p.hide_drop ? null : (
                                    <th className="print-matrix-head border border-stone-300 px-1 py-0.5 text-left font-medium">
                                      Drop
                                    </th>
                                  )}
                                  {p.sizes.map((s) => (
                                    <th
                                      key={s.id}
                                      className="print-matrix-head border border-stone-300 px-1 py-0.5 font-medium tabular-nums"
                                    >
                                      {s.code}
                                    </th>
                                  ))}
                                  <th className="print-matrix-head border border-stone-300 px-1 py-0.5 font-medium">
                                    Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {dropRows.map((d) => {
                                  const rowSum = p.sizes.reduce(
                                    (sum, s) => sum + qtyAt(s.id, d.id),
                                    0,
                                  );
                                  return (
                                    <tr key={d.id || "none"}>
                                      {p.hide_drop ? null : (
                                        <th className="border border-stone-300 bg-white px-1 py-0.5 text-left font-medium">
                                          {d.code}
                                        </th>
                                      )}
                                      {p.sizes.map((s) => {
                                        const q = qtyAt(s.id, d.id);
                                        return (
                                          <td
                                            key={s.id}
                                            className="border border-stone-300 px-1 py-0.5 tabular-nums"
                                          >
                                            {displayQty(q)}
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
                              <tfoot>
                                <tr>
                                  <td
                                    colSpan={p.sizes.length + (p.hide_drop ? 0 : 1)}
                                    className="border-0 p-0"
                                  />
                                  <td className="px-1 py-0.5 text-center font-semibold tabular-nums">
                                    {displayQty(p.total)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-stone-400">No qty</p>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
              </td>
              </tr>
            );
          })
            )}
            {report.item_totals.length > 0 ? (
              <tr>
                <td>
                  <section className="print-lot print-summary mt-2 rounded border border-stone-400">
                    <div className="print-lot-head border-b border-stone-400 px-2 py-0.5">
                      <p className="text-sm font-semibold leading-tight">Summary</p>
                    </div>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="print-matrix-head border-b border-stone-300 px-2 py-1 text-left font-medium">
                            Item
                          </th>
                          <th className="print-matrix-head w-[20%] border-b border-stone-300 px-2 py-1 text-right font-medium">
                            Qty
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.item_totals.map((row) => (
                          <tr key={row.item}>
                            <td className="border-b border-stone-200 px-2 py-1">{row.item}</td>
                            <td className="border-b border-stone-200 px-2 py-1 text-right tabular-nums">
                              {displayTotal(row.qty)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th className="px-2 py-1 text-left font-semibold">Total</th>
                          <td className="px-2 py-1 text-right font-semibold tabular-nums">
                            {displayTotal(
                              report.item_totals.reduce((sum, row) => sum + row.qty, 0),
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </section>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
