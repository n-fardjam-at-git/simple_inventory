"use client";

import { DismissNote } from "@/components/DismissNote";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageTitle, Btn } from "@/components/ui";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";
import { VendorAdvicesTable, type AdviceRow } from "./VendorAdvicesTable";
import { AdviceDetailsPanel } from "./AdviceDetailsPanel";
import { createVendorAdvice } from "./actions";
import type { AdviceCutting, AdviceCuttingProduct, AdviceLine } from "./types";

export function VendorAdvicesWorkspace({
  rows,
  lines,
  cuttings,
  products,
  viewer,
  today,
}: {
  rows: AdviceRow[];
  lines: AdviceLine[];
  cuttings: AdviceCutting[];
  products: AdviceCuttingProduct[];
  viewer: "vendor" | "staff";
  today: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [addErr, setAddErr] = useState<string | null>(null);
  const router = useRouter();
  const openRow = rows.find((r) => r.id === openId) ?? null;

  return (
    <>
      <PageTitle title="Vendor packing lists" />
      <FitPage>
        <VendorAdvicesTable rows={rows} viewer={viewer} onOpen={setOpenId} />
        {viewer === "vendor" ? (
          <AddForm
            action={async (formData) => {
              const message = await createVendorAdvice(formData);
              if (typeof message === "string" && message) {
                setAddErr(message);
                return message;
              }
              setAddErr(null);
              router.refresh();
            }}
            className="flex shrink-0 flex-wrap items-center gap-2 text-sm"
          >
            <input
              name="ship_date"
              type="date"
              required
              defaultValue={today}
              aria-label="Ship date"
              className="rounded border px-2 py-1"
            />
            <input
              name="air_way_no"
              placeholder="Air way no"
              className="rounded border px-2 py-1"
            />
            <Btn type="submit">Add</Btn>
            {addErr ? <DismissNote onDismiss={() => setAddErr(null)}>{addErr}</DismissNote> : null}
          </AddForm>
        ) : null}
      </FitPage>
      <AdviceDetailsPanel
        open={openId != null}
        onClose={() => setOpenId(null)}
        advice={openRow}
        lines={lines}
        cuttings={cuttings}
        products={products}
        canEdit={viewer === "vendor"}
      />
    </>
  );
}
