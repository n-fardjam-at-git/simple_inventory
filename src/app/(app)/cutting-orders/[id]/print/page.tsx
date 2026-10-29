import { notFound } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCuttingOrderReport } from "@/lib/cutting-order-report";
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

export default async function CuttingOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRoles(["admin", "warehouse", "vendor"]);
  if (profile.role === "vendor") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cutting_orders")
      .select("date_submitted")
      .eq("id", id)
      .maybeSingle();
    if (!data?.date_submitted) notFound();
  }
  const report = await loadCuttingOrderReport(id);
  if (!report) notFound();

  return (
    <>
      <PrintActions
        title={`Cutting ${report.order_num}${report.vendor ? ` · ${report.vendor}` : ""}`}
        orderLabel={`Cutting ${report.order_num}`}
        vendorLabel={`To ${report.vendor ?? "—"}`}
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
                  <span className="font-semibold tabular-nums">Cutting {report.order_num}</span>
                  <span>To {report.vendor ?? "—"}</span>
                  <span className="print-page-n tabular-nums" />
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="print-meta mb-2 border-b border-stone-300 pb-1 text-sm text-stone-600">
                  Brand {report.brand ?? "—"}
                  {report.date ? (
                    <span className="ml-3 tabular-nums">Date {report.date}</span>
                  ) : null}
                  {report.reference ? <span className="ml-3">PO {report.reference}</span> : null}
                </div>
              </td>
            </tr>
            {report.lots.length === 0 ? (
              <tr>
                <td>
                  <p className="print-lot text-sm text-stone-500">No lots on this order.</p>
                </td>
              </tr>
            ) : (
              report.lots.map((lot) => {
                return (
                  <tr key={lot.lot_id}>
                    <td>
                      <section className="print-lot mt-2 rounded border border-stone-400">
                        <div className="print-lot-head border-b border-stone-400 px-2 py-0.5">
                          <p className="text-sm font-semibold leading-tight">
                            {lot.lot_no}
                            {lot.mill_article ? (
                              <span className="ml-2 font-light text-stone-700">
                                • {lot.mill_article}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        {lot.products.length === 0 ? (
                          <p className="px-2 py-1 text-sm text-stone-500">No products on this lot.</p>
                        ) : (
                          <table className="print-lot-cont print-lot-quiet w-full border-collapse">
                            <thead>
                              <tr>
                                <td className="print-lot-cont-head" />
                              </tr>
                            </thead>
                            <tbody>
                              {lot.products.map((p, i) => {
                                const qtyAt = (sizeId: string, dropId: string) =>
                                  p.cells.find((c) => c.size_id === sizeId && c.drop_id === dropId)
                                    ?.qty ?? 0;
                                const showGrid = p.sizes.length > 0 && p.cells.length > 0;
                                const dropRows =
                                  p.hide_drop || isNoDropAxis(p.drops)
                                    ? [{ id: p.drops[0]?.id ?? "", code: "" }]
                                    : p.drops;
                                return (
                                  <tr key={p.product_id}>
                                    <td
                                      className={`px-2 break-inside-avoid ${
                                        i > 0 ? "border-t border-dashed border-stone-300 pt-2" : "pt-1"
                                      } pb-2`}
                                    >
                                      <p className="mb-1 text-sm font-medium leading-tight">
                                        {p.model}
                                        {p.item ? (
                                          <span className="ml-2 text-xs font-normal text-stone-500">
                                            {p.item}
                                          </span>
                                        ) : null}
                                      </p>
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
                                                    {p.sizes.map((s) => (
                                                      <td
                                                        key={s.id}
                                                        className="border border-stone-300 px-1 py-0.5 tabular-nums"
                                                      >
                                                        {displayQty(qtyAt(s.id, d.id))}
                                                      </td>
                                                    ))}
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
                                                  {displayTotal(p.total)}
                                                </td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="text-sm tabular-nums text-stone-700">
                                          {p.bulk_order_qty != null ? (
                                            <>Bulk • {p.bulk_order_qty}</>
                                          ) : (
                                            <span className="text-stone-400">Not sized</span>
                                          )}
                                        </p>
                                      )}
                                      {p.instructions ? (
                                        <p className="mt-1 text-xs text-stone-600">
                                          Instructions • {p.instructions}
                                        </p>
                                      ) : null}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </section>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
