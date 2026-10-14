"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { isSpecialPriceStage, productTitle, productTypeLabel, priceStageLabel } from "@/lib/product-type";
import { PriceStageRadios } from "@/components/PriceStageRadios";
import { AvailabilityPicker } from "@/components/AvailabilityPicker";
import { type SeasonRow } from "@/lib/season";
import { deleteProduct, updateProductRow } from "@/app/(app)/products/actions";
import { toSentenceCase } from "@/lib/text-case";
import { NumericInput } from "@/components/NumericInput";
import { ComboBox } from "@/components/ComboBox";

export type Row = {
  id: string;
  type: number;
  name: string | null;
  standard_price: number;
  price_stage?: number;
  availability?: string | null;
  is_active: boolean;
  collection_id?: string | null;
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
}: {
  rows: Row[];
  canEdit: boolean;
  showType?: boolean;
  seasons?: SeasonRow[];
  collections?: { id: string; name: string; is_active: boolean }[];
  resumeId?: string | null;
  focusId?: string | null;
  focusNonce?: number;
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
            {showType ? null : <th></th>}
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
}: {
  row: Row;
  canEdit: boolean;
  showType: boolean;
  seasons: SeasonRow[];
  collections: { id: string; name: string; is_active: boolean }[];
}) {
  const merch = (row.type ?? 1) === 1;
  const [name, setName] = useState(row.name ?? "");
  const [price, setPrice] = useState(String(row.standard_price));
  const [active, setActive] = useState(row.is_active);
  const [priceStage, setPriceStage] = useState(row.price_stage ?? 1);
  const [availability, setAvailability] = useState<string | null>(row.availability ?? null);
  const [collectionId, setCollectionId] = useState(row.collection_id ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const snapshot = {
    name: row.name ?? "",
    price: String(row.standard_price),
    active: row.is_active,
    priceStage: row.price_stage ?? 1,
    availability: row.availability ?? null,
    collectionId: row.collection_id ?? "",
  };
  const dirty =
    name !== snapshot.name ||
    Number(price) !== Number(snapshot.price) ||
    active !== snapshot.active ||
    (merch && priceStage !== snapshot.priceStage) ||
    (merch && availability !== snapshot.availability) ||
    (merch && collectionId !== snapshot.collectionId);

  const list = useList();
  const router = useRouter();
  function persist() {
    return new Promise<boolean>((resolve) => {
      start(async () => {
          const message = await updateProductRow(row.id, {
            name: merch ? undefined : name,
            standard_price: Number(price) || 0,
            is_active: active,
            price_stage: merch ? priceStage : undefined,
            availability: merch ? availability : undefined,
            collection_id: merch ? collectionId : undefined,
          });
        if (message) {
          setErr(message);
          resolve(false);
        } else {
          setErr(null);
          list.finishEdit(row.id);
          resolve(true);
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
      setPriceStage(snapshot.priceStage);
      setAvailability(snapshot.availability);
      setCollectionId(snapshot.collectionId);
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
  const fabric = [row.lots?.colors?.name, row.lots?.patterns?.name, row.lots?.contents?.name]
    .filter(Boolean)
    .join(", ");
  const brandItem = [row.lots?.brands?.name, row.models?.items?.name].filter(Boolean).join(" • ");
  const availText = (editing ? availability : row.availability) ?? "";

  return (
    <SelectableRow id={row.id} dimmed={!row.is_active}>
      {showType ? <td className="py-1.5">{productTypeLabel(row.type)}</td> : null}
      <td className={showType ? "font-medium" : "py-1.5"}>
        <div className="font-medium">
          {editing && !merch ? (
            <input
              className="rounded border px-1 py-0.5"
              value={name}
              onChange={(e) => setName(toSentenceCase(e.target.value))}
            />
          ) : (
            <>
              {title}
              {merch && brandItem ? (
                <span className="ml-1.5 text-xs font-light text-stone-500">{brandItem}</span>
              ) : null}
            </>
          )}
        </div>
        {merch ? (
          <>
            <p className="text-xs font-light leading-tight text-stone-500">
              {fabric ? `${fabric}. ` : ""}
              {editing ? (
                <button
                  type="button"
                  className="text-violet-700 underline decoration-violet-400"
                  onClick={() => setActive((v) => !v)}
                >
                  {active ? "Active" : "Inactive"}
                </button>
              ) : active ? (
                "Active"
              ) : (
                "Inactive"
              )}
              {!editing && availText ? ` · ${availText}` : null}
            </p>
            {editing ? (
              <div className="mt-1">
                <AvailabilityPicker
                  formFields={false}
                  seasons={seasons}
                  value={availability}
                  onChange={setAvailability}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </td>
      {showType ? null : (
        <td className="whitespace-nowrap text-xs">
          {editing ? (
            <PriceStageRadios value={priceStage} onChange={setPriceStage} />
          ) : isSpecialPriceStage(row.price_stage) ? (
            <span className="font-medium text-red-700">{priceStageLabel(row.price_stage)}</span>
          ) : null}
        </td>
      )}
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
      {showType ? null : (
        <td className="text-sm">
          {editing ? (
            <ComboBox
              allowEmpty
              className="w-40 rounded border px-1 py-0.5"
              value={collectionId}
              onChange={setCollectionId}
              options={collections
                .filter((c) => c.is_active || c.id === collectionId)
                .map((c) => ({ id: c.id, label: c.name }))}
            />
          ) : (
            row.collections?.name ?? ""
          )}
        </td>
      )}
      {showType ? (
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
      ) : null}
      {showType ? null : (
        <td>
          <Link
            className="text-xs text-stone-700 underline"
            href={editing ? `/products/${row.id}?edit=1` : `/products/${row.id}`}
            onClick={(e) => {
              if (!editing || !dirty) return;
              e.preventDefault();
              list.tryLeave(() => router.push(`/products/${row.id}?edit=1`));
            }}
          >
            Settings
          </Link>
        </td>
      )}
      <td className="py-1">
        {canEdit ? (
          <RowButtons
            editing={editing}
            dirty={dirty}
            onEdit={requestEdit}
            onSave={() => void persist()}
            onCancel={requestCancel}
            onDelete={() => {
              if (!confirm(`Delete ${title}?`)) return;
              start(async () => {
                const message = await deleteProduct(row.id);
                if (message) setErr(message);
              });
            }}
          />
        ) : null}
        {err ? <p className="text-xs text-red-700">{err}</p> : null}
        {pending ? <p className="text-xs text-stone-400">Working…</p> : null}
      </td>
    </SelectableRow>
  );
}
