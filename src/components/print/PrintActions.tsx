"use client";

import { useEffect, type ReactNode } from "react";

function cssString(value: string) {
  return JSON.stringify(value);
}

function inchPx(n: number) {
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;left:-9999px;height:${n}in;width:1px;`;
  document.body.appendChild(probe);
  const px = probe.offsetHeight || n * 96;
  probe.remove();
  return px;
}

function outerHeight(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return (
    rect.height +
    parseFloat(style.marginTop) +
    parseFloat(style.marginBottom)
  );
}

type Chunk = { height: number; lotId: string | null; breakBefore?: boolean };

function measureChunks(report: HTMLElement): Chunk[] {
  const host = document.createElement("div");
  host.style.cssText =
    "position:absolute;left:-10000px;top:0;width:7.5in;visibility:hidden;";
  const clone = report.cloneNode(true) as HTMLElement;
  clone.style.width = "7.5in";
  host.appendChild(clone);
  document.body.appendChild(host);

  const chunks: Chunk[] = [];
  const push = (
    el: HTMLElement | null,
    lotId: string | null,
    breakBefore?: boolean,
  ) => {
    if (!el) return;
    const height = outerHeight(el);
    if (height > 0) chunks.push({ height, lotId, breakBefore });
  };

  push(clone.querySelector(".print-first-title"), null);
  push(clone.querySelector(".print-page-head"), null);
  push(clone.querySelector(".print-meta"), null);

  clone.querySelectorAll<HTMLElement>(".print-lot").forEach((lot, lotIndex) => {
    const lotId = lot.dataset.lotId ?? String(lotIndex);
    const lotHead = lot.querySelector<HTMLElement>(".print-lot-head");
    const products = [
      ...lot.querySelectorAll<HTMLElement>("table.print-lot-cont > tbody > tr"),
    ];
    const breakBefore = lot.classList.contains("print-summary");
    if (products.length === 0) {
      push(lot, lotId, breakBefore);
      return;
    }
    const headH = lotHead ? outerHeight(lotHead) : 0;
    const lotGap = parseFloat(getComputedStyle(lot).marginTop) || 0;
    products.forEach((row, i) => {
      let height = outerHeight(row);
      if (i === 0) height += headH + lotGap;
      chunks.push({ height, lotId });
    });
  });

  host.remove();
  return chunks;
}

function countPrintPages(report: HTMLElement, repeatPageHead: boolean) {
  const firstPage = inchPx(10);
  const laterPage = inchPx(repeatPageHead ? 10 : 9.8);
  const continuation = inchPx(0.22);
  const chunks = measureChunks(report);
  if (chunks.length === 0) return 1;

  const pageHead = report.querySelector<HTMLElement>(".print-page-head");
  const laterHead = repeatPageHead && pageHead ? outerHeight(pageHead) : 0;

  let pages = 1;
  let used = 0;
  let pageH = firstPage;

  chunks.forEach((chunk, i) => {
    let h = chunk.height;
    const sameLot =
      i > 0 && chunks[i - 1].lotId != null && chunks[i - 1].lotId === chunk.lotId;

    if (chunk.breakBefore && used > 0) {
      pages += 1;
      used = laterHead;
      pageH = laterPage;
    }

    if (used > 0 && used + h > pageH) {
      pages += 1;
      used = laterHead + (sameLot ? continuation : 0);
      pageH = laterPage;
    }

    while (h > 0 && used + h > pageH) {
      h -= pageH - used;
      pages += 1;
      used = laterHead + (sameLot ? continuation : 0);
      pageH = laterPage;
    }
    used += h;
  });

  return Math.max(1, pages);
}

export function PrintActions({
  title,
  orderLabel,
  vendorLabel,
  repeatPageHead = false,
  marginPageNumbers = false,
  autoPrint = true,
  children,
}: {
  children?: ReactNode;
  /** Open the print dialog as soon as the page loads. Off: the page waits for Print or Save PDF. */
  autoPrint?: boolean;
  title: string;
  orderLabel: string;
  vendorLabel: string;
  /** Repeat the in-flow `.print-page-head` (table thead). No CSS margin-box header. */
  repeatPageHead?: boolean;
  /** Print "Page X of Y" in the bottom margin. The browser counts the pages. */
  marginPageNumbers?: boolean;
}) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    let cancelled = false;
    let printed = false;
    const style = document.createElement("style");
    style.setAttribute("data-print-page-head", "");

    function printOnce() {
      if (!autoPrint || cancelled || printed) return;
      printed = true;
      window.print();
    }

    async function stampPages() {
      await document.fonts.ready;
      if (cancelled) return;

      if (marginPageNumbers) {
        style.textContent = `@media print {
        @page {
          size: 8.5in 11in;
          margin: 0.5in 0.5in 0.65in;
          @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 9pt;
            color: #1c1917;
          }
        }
      }`;
        document.head.appendChild(style);
        printOnce();
        return;
      }

      const report = document.querySelector<HTMLElement>(".print-report");
      const total = report ? countPrintPages(report, repeatPageHead) : 1;

      document.querySelectorAll(".print-page-n").forEach((el) => {
        el.textContent = `1 of ${total}`;
      });

      style.textContent = repeatPageHead
        ? `@media print {
        @page {
          size: 8.5in 11in;
          margin: 0.5in;
        }
      }`
        : `@media print {
        @page {
          size: 8.5in 11in;
          margin: 0.7in 0.5in 0.5in;
          @top-left {
            content: ${cssString(orderLabel)};
            font-size: 9pt;
            font-weight: 600;
            color: #1c1917;
          }
          @top-center {
            content: ${cssString(vendorLabel)};
            font-size: 9pt;
            color: #1c1917;
          }
          @top-right {
            content: counter(page) " of ${total}";
            font-size: 9pt;
            color: #1c1917;
          }
        }
        @page :first {
          margin: 0.5in;
          @top-left { content: none; }
          @top-center { content: none; }
          @top-right { content: none; }
        }
      }`;
      document.head.appendChild(style);
      printOnce();
    }

    const t = window.setTimeout(() => {
      void stampPages().catch(() => printOnce());
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      document.title = prev;
      style.remove();
    };
  }, [title, orderLabel, vendorLabel, repeatPageHead, marginPageNumbers, autoPrint]);

  return (
    <div className="print:hidden mb-4 flex gap-2">
      <button
        type="button"
        className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800"
        onClick={() => window.print()}
      >
        Print
      </button>
      {children}
      <button
        type="button"
        className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
        onClick={() => window.close()}
      >
        Close
      </button>
    </div>
  );
}
