"use client";

import { useState } from "react";
import type { CustomerOrderReport } from "@/lib/customer-order-report";
import { DismissNote } from "@/components/DismissNote";
import { saveCustomerOrderPdf } from "@/lib/customer-order-pdf";

/** Downloads the customer order report as `{fileName}.pdf`. Nothing is written to the database. */
export function SavePdfButton({
  report,
  fileName,
}: {
  report: CustomerOrderReport;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await saveCustomerOrderPdf(report, fileName);
    } catch {
      setErr("Could not make the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50 disabled:opacity-50"
        onClick={() => void save()}
      >
        Save PDF
      </button>
      {err ? (
        <DismissNote className="self-center text-sm text-red-700" onDismiss={() => setErr(null)}>
          {err}
        </DismissNote>
      ) : null}
    </>
  );
}
