"use client";

import { DismissNote } from "@/components/DismissNote";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { isSpecialPriceStage, productTitle, productTypeLabel, priceStageLabel } from "@/lib/product-type";
import { type SeasonRow } from "@/lib/season";
import { deleteProduct, updateProductRow } from "@/app/(app)/products/actions";
import { toSentenceCase } from "@/lib/text-case";
import { NumericInput } from "@/components/NumericInput";
import type { ProductTemplateOption } from "./SaveAsTemplatePopup";
import { ProductEditPopup } from "./ProductEditPopup";

export type Row = {
  id: string;
  type: number;
  name: string | null;
  standard_price: number;
  price_stage?: number;
  availability?: string | null;
  is_active: boolean;
  collection_id?: string | null;
  size_chart_id?: string | null;
  collections?: { name: string } | null;
  lots: {
    lot_no: string;
    brand_id?: string | null;
    color_id?: string | null;
    pattern_id?: string | null;
    content_id?: string | null;
    brands?: { name: string } | null;
    colors?: { name: string } | null;
    patterns?: { name: string } | null;
    contents?: { name: string } | null;
  } | null;
  models: {
    id?: string;
    name: string;
    item_id?: string | null;
    items: { name: string } | null;
  } | null;
};

export function ProductsTable({
  rows,
  canEdit,
  showType = false,
  seasons = [],
  collections = [],
  resumeId = null,
  focusId = null,
  focusNonce = 0,
  templates = [],
}: {
  rows: Row[];
  canEdit: boolean;
  showType?: boolean;
  seasons?: SeasonRow[];
  collections?: { id: string; name: string; is_active: boolean }[];
  resumeId?: string | null;
  focusId?: string | null;
  focusNonce?: number;
  templates?: ProductTemplateOption[];
}) {
  useEffect(() => {
    if (!resumeId || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("edit")) return;
    url.searchParams.delete("edit");
    const qs = url.searchParams.toString();
    window.history.replaceState(null, "", url.pathname + (qs ? `?${qs}` : ""));
  }, [resumeId]);

  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      resumeId={resumeId}
      focusId={focusId}
      focusNonce={focusNonce}
      thead={
        <thead>
          <tr className="text-stone-500">
            {showType ? <th className="py-1">Type</th> : null}
            <th className={showType ? "" : "py-1"}>Product</th>
            {showType ? null : <th></th>}
            <th>{showType ? "Cost" : "Price"}</th>
            {showType ? <th>Status</th> : null}
            {showType ? null : <th>Collection</th>}
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => (
        <ProductRow
          row={r}
          canEdit={canEdit}
          showType={showType}
          seasons={seasons}
          collections={collections}
          templates={templates}
        />
      )}
    />
  );
}

function ProductRow({
  row,
  canEdit,
  showType,
  seasons,
  collections,
  templates,
}: {
  row: Row;
  canEdit: boolean;
  showType: boolean;
  seasons: SeasonRow[];
  collections: { id: string; name: string; is_active: boolean }[];
  templates: ProductTemplateOption[];
}) {
  const merch = (row.type ?? 1) === 1 && !showType;
  if (merch) {
    return (
      <MerchRow
        row={row}
        canEdit={canEdit}
        seasons={seasons}
        collections={collections}
        templates={templates}
      />
    );
  }
  return <ChargeRow row={row} canEdit={canEdit} showType={showType} />;
}

function MerchRow({
  row,
  canEdit,
  seasons,
  collections,
  templates,
}: {
  row: Row;
  canEdit: boolean;
  seasons: SeasonRow[];
  collections: { id: string; name: string; is_active: boolean }[];
  templates: ProductTemplateOption[];
}) {
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "delete">(null);
  const [err, setErr] = useState<string | null>(null);
  const [popupDirty, setPopupDirty] = useState(false);
  const persistRef = useRef<() => Promise<boolean>>(async () => true);
  const router = useRouter();
  const title = productTitle({
    type: row.type,
    name: row.name,
    lots: row.lots,
    models: row.models,
  });
  const fabric = [row.lots?.colors?.name, row.lots?.patterns?.name, row.lots?.contents?.name]
    .filter(Boolean)
    .join(", ");
  const brandItem = [row.lots?.brands?.name, row.models?.items?.name].filter(Boolean).join(" • ");

  const { editing, requestEdit, requestCancel, finishEdit } = useListRow(row.id, {
    dirty: popupDirty,
    revert: () => setPopupDirty(false),
    save: () => persistRef.current(),
  });

  useEffect(() => {
    if (!editing) setPopupDirty(false);
  }, [editing]);

  return (
    <SelectableRow id={row.id} dimmed={!row.is_active}>
      <td className="py-1.5">
        <div className="font-medium">
          {title}
          {brandItem ? (
            <span className="ml-1.5 text-xs font-light text-stone-500">{brandItem}</span>
          ) : null}
        </div>
        <p className="text-xs font-light leading-tight text-stone-500">
          {fabric ? `${fabric}. ` : ""}
          {row.is_active ? "Active" : "Inactive"}
          {row.availability ? ` · ${row.availability}` : null}
        </p>
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
      <td className="whitespace-nowrap text-xs">
        {isSpecialPriceStage(row.price_stage) ? (
          <span className="font-medium text-red-700">{priceStageLabel(row.price_stage)}</span>
        ) : null}
      </td>
      <td>{`$${Number(row.standard_price).toFixed(2)}`}</td>
      <td className="text-sm">{row.collections?.name ?? ""}</td>
      <td className="py-1">
        {canEdit ? (
          <RowButtons
            editing={editing}
            dirty={false}
            deleting={job === "delete"}
            onEdit={requestEdit}
            onSave={() => void persistRef.current()}
            onCancel={() => requestCancel()}
            onDelete={() => {
              if (!confirm(`Delete ${title}?`)) return;
              setJob("delete");
              start(async () => {
                try {
                  const message = await deleteProduct(row.id);
                  if (message) setErr(message);
                } finally {
                  setJob(null);
                }
              });
            }}
          />
        ) : null}
      </td>
      {editing ? (
        <ProductEditPopup
          row={row}
          title={title}
          seasons={seasons}
          collections={collections}
          templates={templates}
          persistRef={persistRef}
          onDirtyChange={setPopupDirty}
          onCancel={() => requestCancel()}
          onSaved={() => {
            setPopupDirty(false);
            finishEdit();
            router.refresh();
          }}
        />
      ) : null}
    </SelectableRow>
  );
}

function ChargeRow({
  row,
  canEdit,
  showType,
}: {
  row: Row;
  canEdit: boolean;
  showType: boolean;
}) {
  const [name, setName] = useState(row.name ?? "");
  const [price, setPrice] = useState(String(row.standard_price));
  const [active, setActive] = useState(row.is_active);
  const [, start] = useTransition();
  const [job, setJob] = useState<null | "save" | "delete">(null);
  const [err, setErr] = useState<string | null>(null);
  const snapshot = {
    name: row.name ?? "",
    price: String(row.standard_price),
    active: row.is_active,
  };
  const dirty =
    name !== snapshot.name || Number(price) !== Number(snapshot.price) || active !== snapshot.active;
  const list = useList();
  function persist() {
    return new Promise<boolean>((resolve) => {
      setJob("save");
      start(async () => {
        try {
          const message = await updateProductRow(row.id, {
            name,
            standard_price: Number(price) || 0,
            is_active: active,
          });
          if (message) {
            setErr(message);
            resolve(false);
          } else {
            setErr(null);
            list.finishEdit(row.id);
            resolve(true);
          }
        } finally {
          setJob(null);
        }
      });
    });
  }
  const { editing, requestEdit, requestCancel } = useListRow(row.id, {
    dirty,
    revert: () => {
      setName(snapshot.name);
      setPrice(snapshot.price);
      setActive(snapshot.active);
      setErr(null);
    },
    save: persist,
  });
  const title = productTitle({
    type: row.type,
    name: row.name,
    lots: row.lots,
    models: row.models,
  });

  return (
    <SelectableRow id={row.id} dimmed={!row.is_active}>
      {showType ? <td className="py-1.5">{productTypeLabel(row.type)}</td> : null}
      <td className={showType ? "font-medium" : "py-1.5"}>
        {editing ? (
          <input
            className="rounded border px-1 py-0.5"
            value={name}
            onChange={(e) => setName(toSentenceCase(e.target.value))}
          />
        ) : (
          <div className="font-medium">{title}</div>
        )}
      </td>
      <td>
        {editing ? (
          <NumericInput
            className="w-24 rounded border px-1 py-0.5"
            decimal
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        ) : (
          `$${Number(row.standard_price).toFixed(2)}`
        )}
      </td>
      <td>
        {editing ? (
          <label className="text-xs">
            <input
              type="checkbox"
              className="mr-1"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
        ) : row.is_active ? (
          "Active"
        ) : (
          "Inactive"
        )}
      </td>
      <td className="py-1">
        {canEdit ? (
          <RowButtons
            editing={editing}
            dirty={dirty}
            saving={job === "save"}
            deleting={job === "delete"}
            onEdit={requestEdit}
            onSave={() => void persist()}
            onCancel={requestCancel}
            onDelete={() => {
              if (!confirm(`Delete ${title}?`)) return;
              setJob("delete");
              start(async () => {
                try {
                  const message = await deleteProduct(row.id);
                  if (message) setErr(message);
                } finally {
                  setJob(null);
                }
              });
            }}
          />
        ) : null}
        {err ? <DismissNote onDismiss={() => setErr(null)}>{err}</DismissNote> : null}
      </td>
    </SelectableRow>
  );
}
