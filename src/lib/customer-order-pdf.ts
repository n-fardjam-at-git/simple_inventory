import type { CustomerOrderReport, OrderReportLine } from "@/lib/customer-order-report";
import { orderStatusLabel } from "@/lib/customer-order";
import { PRODUCT_TYPE, productTypeLabel } from "@/lib/product-type";
import { isNoDropAxis } from "@/lib/size-code";

type Rgb = [number, number, number];

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 36;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 47;

const INK: Rgb = [28, 25, 23];
const MUTED: Rgb = [120, 113, 108];
const RULE: Rgb = [214, 211, 209];
const BAR: Rgb = [231, 229, 228];
const BORDER: Rgb = [168, 162, 158];
const AMBER: Rgb = [180, 83, 9];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function displayDate(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${m}/${d}/${y}`;
}

function today() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${now.getFullYear()}`;
}

/**
 * Build the customer order report as a PDF in the browser and download it as
 * `{fileName}.pdf`. Same groups as the print page: Order details, one box per
 * product, Charges, Order summary. A box never splits across pages.
 */
export async function saveCustomerOrderPdf(report: CustomerOrderReport, fileName: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setProperties({ title: fileName });
  const contentW = PAGE_W - MARGIN_X * 2;
  let y = MARGIN_TOP;

  type TextOpts = { size?: number; bold?: boolean; color?: Rgb; align?: "left" | "center" | "right" };

  function text(value: string, x: number, baseline: number, opts: TextOpts = {}) {
    const { size = 8, bold = false, color = INK, align = "left" } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x, baseline, { align });
  }

  function width(value: string, size: number, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    return doc.getTextWidth(value);
  }

  function wrap(value: string, maxW: number, size: number, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    return doc.splitTextToSize(value, Math.max(20, maxW)) as string[];
  }

  /** jsPDF shares one fill color between text and shapes, so set it before every filled shape. */
  function headCell(x: number, yy: number, w: number, h: number) {
    doc.setFillColor(BAR[0], BAR[1], BAR[2]);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.5);
    doc.rect(x, yy, w, h, "FD");
  }

  function hLine(x1: number, x2: number, yy: number, color: Rgb, weight: number) {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(weight);
    doc.line(x1, yy, x2, yy);
  }

  /** Order {n}, customer, and a heavy rule. Printed at the top of every page. */
  function pageHead() {
    text(`Order ${report.order_no}`, MARGIN_X, y + 9, { size: 10, bold: true });
    text(report.customer, PAGE_W / 2, y + 9, { size: 10, align: "center" });
    hLine(MARGIN_X, PAGE_W - MARGIN_X, y + 14, INK, 1.5);
    y += 22;
  }

  function ensure(height: number) {
    if (y + height > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      pageHead();
    }
  }

  /** A body measures itself with draw=false, then paints with draw=true. */
  type Body = (draw: boolean, x: number, top: number, w: number) => number;

  function box(
    title: string,
    opts: { status?: string; right?: string; body: Body },
  ) {
    const barH = 16;
    const gap = 7;
    const bodyW = contentW - 12;
    const bodyH = opts.body(false, MARGIN_X + 6, 0, bodyW);
    ensure(gap + barH + bodyH);
    y += gap;
    doc.setFillColor(BAR[0], BAR[1], BAR[2]);
    doc.rect(MARGIN_X, y, contentW, barH, "F");
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.7);
    doc.roundedRect(MARGIN_X, y, contentW, barH + bodyH, 2, 2, "S");
    doc.line(MARGIN_X, y + barH, MARGIN_X + contentW, y + barH);
    text(title, MARGIN_X + 6, y + 11.3, { size: 9.5, bold: true });
    if (opts.status) {
      text(opts.status, MARGIN_X + 6 + width(title, 9.5, true) + 6, y + 11.3, {
        size: 9.5,
        color: MUTED,
      });
    }
    if (opts.right) {
      text(opts.right, MARGIN_X + contentW - 6, y + 11.3, { size: 9.5, bold: true, align: "right" });
    }
    opts.body(true, MARGIN_X + 6, y + barH, bodyW);
    y += barH + bodyH;
  }

  // ---- Page 1 head -------------------------------------------------------
  text(report.company, PAGE_W / 2, y + 14, { size: 16, bold: true, align: "center" });
  y += 22;
  const dateValue = today();
  text(dateValue, PAGE_W - MARGIN_X, y + 8, { size: 8, align: "right" });
  text("Date", PAGE_W - MARGIN_X - width(dateValue, 8) - 3, y + 8, {
    size: 8,
    color: MUTED,
    align: "right",
  });
  y += 14;
  pageHead();

  // ---- Order details -----------------------------------------------------
  const leftFields: [string, string][] = [
    ["Customer", report.customer],
    ["Terms", report.terms ?? ""],
    ["Shipping method", report.shipping_method ?? ""],
    ["Season", report.future_season ?? ""],
  ];
  const rightFields: [string, string][] = [
    ["Status", orderStatusLabel(report.status)],
    ["Start date", displayDate(report.start_date)],
    ["Cancel date", displayDate(report.cancel_date)],
  ];

  const details: Body = (draw, x, top, w) => {
    const colGap = 18;
    const colW = (w - colGap) / 2;
    const labelW = 74;
    let yy = top + 5;

    function fieldColumn(cx: number, fields: [string, string][]) {
      let cy = yy;
      for (const [label, raw] of fields) {
        const lines = wrap(raw || "-", colW - labelW, 8);
        if (draw) {
          text(label, cx, cy + 8, { color: MUTED });
          lines.forEach((line, i) => text(line, cx + labelW, cy + 8 + i * 10));
        }
        cy += lines.length * 10 + 1.5;
      }
      return cy - yy;
    }
    const topH = Math.max(fieldColumn(x, leftFields), fieldColumn(x + colW + colGap, rightFields));
    yy += topH + 5;
    if (draw) hLine(x, x + w, yy, RULE, 0.5);
    yy += 5;

    const blocks: [string, string[]][] = [
      ["SHIP TO", report.ship_to],
      ["BILL TO", report.bill_to],
    ];
    const wrapped = blocks.map(([, lines]) =>
      (lines.length ? lines : ["No address"]).flatMap((line) => wrap(line, colW, 8)),
    );
    if (draw) {
      blocks.forEach(([title], i) => {
        const bx = x + i * (colW + colGap);
        text(title, bx, yy + 7, { size: 6.5, bold: true, color: MUTED });
        text(report.customer, bx, yy + 17, { bold: true });
        wrapped[i].forEach((line, j) =>
          text(line, bx, yy + 27 + j * 10, {
            color: report[i === 0 ? "ship_to" : "bill_to"].length ? INK : MUTED,
          }),
        );
      });
    }
    yy += 19 + Math.max(...wrapped.map((lines) => lines.length)) * 10;

    if (report.notes) {
      yy += 3;
      if (draw) hLine(x, x + w, yy, RULE, 0.5);
      yy += 5;
      const lines = wrap(report.notes, w - 28, 8);
      if (draw) {
        text("Notes", x, yy + 8, { color: MUTED });
        lines.forEach((line, i) => text(line, x + 28, yy + 8 + i * 10));
      }
      yy += lines.length * 10;
    }
    return yy + 6 - top;
  };
  box("Order details", { body: details });

  // ---- Merchandise -------------------------------------------------------
  function merchandiseBody(line: OrderReportLine): Body {
    const showGrid = line.sizes.length > 0 && line.cells.length > 0;
    const dropRows =
      line.hide_drop || isNoDropAxis(line.drops)
        ? [{ id: line.drops[0]?.id ?? "", code: "" }]
        : line.drops;
    const detail = [line.article, line.model, line.item].filter(Boolean).join(" · ");
    const detailText = [detail, line.fabric].filter(Boolean).join("   ");
    const cellAt = (sizeId: string, dropId: string) =>
      line.cells.find((cell) => cell.size_id === sizeId && cell.drop_id === dropId) ?? null;

    return (draw, x, top, w) => {
      let yy = top + 5;
      if (detailText) {
        const lines = wrap(detailText, w, 8);
        if (draw) lines.forEach((l, i) => text(l, x, yy + 7 + i * 9.5, { color: MUTED }));
        yy += lines.length * 9.5 + 3;
      }
      if (showGrid) {
        const dropW = line.hide_drop ? 0 : w * 0.12;
        const totalW = w * 0.1;
        const sizeW = (w - dropW - totalW) / line.sizes.length;
        const fontSize = line.sizes.length > 12 ? 7 : 8;
        const headH = 13;

        if (draw) {
          let cx = x;
          if (!line.hide_drop) {
            headCell(cx, yy, dropW, headH);
            text("Drop", cx + 3, yy + 9.2, { size: fontSize, bold: true });
            cx += dropW;
          }
          for (const size of line.sizes) {
            headCell(cx, yy, sizeW, headH);
            text(size.code, cx + sizeW / 2, yy + 9.2, { size: fontSize, bold: true, align: "center" });
            cx += sizeW;
          }
          headCell(cx, yy, totalW, headH);
          text("Total", cx + totalW / 2, yy + 9.2, { size: fontSize, bold: true, align: "center" });
        }
        yy += headH;

        for (const drop of dropRows) {
          const hasExtra = line.sizes.some((size) => {
            const cell = cellAt(size.id, drop.id);
            return cell && cell.qty > 0 && cell.extra > 0;
          });
          const rowH = hasExtra ? 21 : 13;
          if (draw) {
            let cx = x;
            if (!line.hide_drop) {
              doc.rect(cx, yy, dropW, rowH, "S");
              text(drop.code, cx + 3, yy + 9.2, { size: fontSize, bold: true });
              cx += dropW;
            }
            let rowSum = 0;
            for (const size of line.sizes) {
              const cell = cellAt(size.id, drop.id);
              doc.rect(cx, yy, sizeW, rowH, "S");
              if (cell && cell.qty > 0) {
                rowSum += cell.qty;
                text(String(Math.round(cell.qty)), cx + sizeW / 2, yy + 9.2, {
                  size: fontSize,
                  align: "center",
                });
                if (cell.extra > 0) {
                  text(`+${cell.extra.toFixed(2)}`, cx + sizeW / 2, yy + 17.4, {
                    size: 6.5,
                    color: AMBER,
                    align: "center",
                  });
                }
              }
              cx += sizeW;
            }
            doc.rect(cx, yy, totalW, rowH, "S");
            if (rowSum > 0) {
              text(String(Math.round(rowSum)), cx + totalW / 2, yy + 9.2, {
                size: fontSize,
                bold: true,
                align: "center",
              });
            }
          }
          yy += rowH;
        }
        yy += 4;
      } else {
        if (draw) text("Not sized", x, yy + 9, { size: 9, color: MUTED });
        yy += 14;
      }

      if (draw) {
        const parts: [string, string, boolean][] = [
          ["Total", String(line.ordered), false],
          ["Shipped", String(line.shipped), false],
          ["Extended", usd.format(line.extended), true],
        ];
        let cx = x + w;
        for (let i = parts.length - 1; i >= 0; i -= 1) {
          const [label, value, bold] = parts[i];
          text(value, cx, yy + 8, { bold, align: "right" });
          cx -= width(value, 8, bold) + 3;
          text(label, cx, yy + 8, { color: MUTED, align: "right" });
          cx -= width(label, 8) + 14;
        }
      }
      yy += 12;
      return yy + 6 - top;
    };
  }

  if (report.merchandise.length === 0) {
    ensure(20);
    y += 7;
    text("No merchandise on this order.", MARGIN_X, y + 9, { size: 9, color: MUTED });
    y += 14;
  }
  for (const line of report.merchandise) {
    box(line.name, {
      status: orderStatusLabel(line.status),
      right: usd.format(line.price),
      body: merchandiseBody(line),
    });
  }

  // ---- Charges -----------------------------------------------------------
  if (report.charges.length > 0) {
    const charges: Body = (draw, x, top, w) => {
      const cols = {
        type: x + w * 0.3,
        status: x + w * 0.43,
        qty: x + w * 0.56 + w * 0.12,
        price: x + w * 0.68 + w * 0.16,
        ext: x + w,
      };
      let yy = top + 4;
      if (draw) {
        text("Charge", x, yy + 8, { color: MUTED, bold: true });
        text("Type", cols.type, yy + 8, { color: MUTED, bold: true });
        text("Status", cols.status, yy + 8, { color: MUTED, bold: true });
        text("Qty", cols.qty, yy + 8, { color: MUTED, bold: true, align: "right" });
        text("Price", cols.price, yy + 8, { color: MUTED, bold: true, align: "right" });
        text("Extended", cols.ext, yy + 8, { color: MUTED, bold: true, align: "right" });
      }
      yy += 12;
      for (const charge of report.charges) {
        if (draw) {
          hLine(x, x + w, yy, RULE, 0.5);
          text(charge.name, x, yy + 9);
          text(productTypeLabel(charge.type), cols.type, yy + 9);
          text(orderStatusLabel(charge.status), cols.status, yy + 9);
          if (charge.type !== PRODUCT_TYPE.freight) {
            text(String(charge.ordered), cols.qty, yy + 9, { align: "right" });
          }
          text(usd.format(charge.price), cols.price, yy + 9, { align: "right" });
          text(usd.format(charge.extended), cols.ext, yy + 9, { bold: true, align: "right" });
        }
        yy += 12;
      }
      return yy + 5 - top;
    };
    box("Charges", { body: charges });
  }

  // ---- Order summary -----------------------------------------------------
  const { summary } = report;
  type SummaryRow = {
    qty?: string;
    label: string;
    amount: string;
    bold?: boolean;
    big?: boolean;
    muted?: boolean;
    ruleAbove?: boolean;
    ruleBelow?: boolean;
  };
  const rows: SummaryRow[] = [
    ...summary.items.map((item) => ({
      qty: String(item.units),
      label: item.item,
      amount: usd.format(item.amount),
      ruleBelow: true,
    })),
    {
      qty: String(summary.units),
      label: "Total quantity",
      amount: usd.format(summary.merchandise),
      bold: true,
      ruleBelow: true,
    },
    { label: "Surcharges", amount: usd.format(summary.surcharge), ruleBelow: true },
    { label: "Freight", amount: usd.format(summary.freight), ruleBelow: true },
    { label: "Grand total", amount: usd.format(summary.total), bold: true, big: true },
    {
      qty: String(summary.shipped_qty),
      label: "Shipped",
      amount: usd.format(summary.shipped_value),
      muted: true,
      ruleAbove: true,
    },
  ];
  const summaryBody: Body = (draw, x, top, w) => {
    const tableW = w * 0.6;
    const x0 = x + w - tableW;
    let yy = top + 4;
    for (const row of rows) {
      const h = row.big ? 17 : 12;
      const size = row.big ? 10 : 8;
      const base = yy + (row.big ? 12.5 : 9);
      const color = row.muted ? MUTED : INK;
      if (draw) {
        if (row.ruleAbove) hLine(x0, x0 + tableW, yy, BORDER, 0.5);
        if (row.qty) text(row.qty, x0 + 30, base, { size, bold: row.bold, color, align: "right" });
        text(row.label, x0 + 38, base, { size, bold: row.bold, color });
        text(row.amount, x0 + tableW, base, { size, bold: row.bold, color, align: "right" });
        if (row.ruleBelow) hLine(x0, x0 + tableW, yy + h, RULE, 0.5);
      }
      yy += h + (row.ruleAbove ? 1 : 0);
    }
    return yy + 5 - top;
  };
  box("Order summary", { body: summaryBody });

  // ---- Page numbers ------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    text(`Page ${page} of ${pages}`, PAGE_W - MARGIN_X, PAGE_H - 26, { size: 9, align: "right" });
  }

  doc.save(`${fileName}.pdf`);
}
