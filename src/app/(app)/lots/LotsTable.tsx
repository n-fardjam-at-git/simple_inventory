"use client";

import { useState, useTransition } from "react";
import { SelectableRow, RowButtons, useList, useListRow } from "@/components/list/ListTable";
import { FitList } from "@/components/list/FitList";
import { deleteLot, updateLotLookups } from "@/app/(app)/models-actions";
import { ComboBox } from "@/components/ComboBox";

export type Opt = { id: string; name: string; is_active: boolean };
export type LotRow = {
  id: string;
  lot_no: string;
  article: string | null;
  color_num: string | null;
  is_active: boolean;
  color_id: string | null;
  pattern_id: string | null;
  content_id: string | null;
  brand_id: string | null;
  brands: { name: string } | null;
};

export function LotsTable({
  rows,
  brands,
  colors,
  patterns,
  contents,
  focusId = null,
  focusNonce = 0,
}: {
  rows: LotRow[];
  brands: { id: string; name: string }[];
  colors: Opt[];
  patterns: Opt[];
  contents: Opt[];
  focusId?: string | null;
  focusNonce?: number;
}) {
  return (
    <FitList
      items={rows}
      getKey={(r) => r.id}
      stretch
      focusId={focusId}
      focusNonce={focusNonce}
      thead={
        <thead>
          <tr className="text-stone-500">
            <th className="py-1">Lot No</th>
            <th>Article</th>
            <th>Color #</th>
            <th>Color</th>
            <th>Pattern</th>
            <th>Content</th>
            <th>Brand</th>
            <th></th>
          </tr>
        </thead>
      }
      renderRow={(r) => (
        <LotRowView
          row={r}
          brands={brands}
          colors={colors}
          patterns={patterns}
          contents={contents}
        />
      )}
    />
  );
}

function LotRowView({
  row,
  brands,
  colors,
  patterns,
  contents,
}: {
  row: LotRow;
  brands: { id: string; name: string }[];
  colors: Opt[];
  patterns: Opt[];
  contents: Opt[];
}) {
  const [colorId, setColorId] = useState(row.color_id ?? "");
  const [patternId, setPatternId] = useState(row.pattern_id ?? "");
  const [contentId, setContentId] = useState(row.content_id ?? "");
  const [brandId, setBrandId] = useState(row.brand_id ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const snapshot = {
    colorId: row.color_id ?? "",
    patternId: row.pattern_id ?? "",
    contentId: row.content_id ?? "",
    brandId: row.brand_id ?? "",
  };
  const dirty =
    colorId !== snapshot.colorId ||
    patternId !== snapshot.patternId ||
    contentId !== snapshot.contentId ||
    brandId !== snapshot.brandId;

  const list = useList();
  function persist() {
    return new Promise<boolean>((resolve) => {
      start(async () => {
        const message = await updateLotLookups(row.id, {
          color_id: colorId,
          pattern_id: patternId,
          content_id: contentId,
          brand_id: brandId,
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
      setColorId(snapshot.colorId);
      setPatternId(snapshot.patternId);
      setContentId(snapshot.contentId);
      setBrandId(snapshot.brandId);
      setErr(null);
    },
    save: persist,
  });

  function label(list: Opt[], id: string | null) {
    return list.find((x) => x.id === id)?.name ?? "—";
  }

  return (
    <SelectableRow id={row.id} dimmed={!row.is_active}>
      <td className="py-1 font-medium">{row.lot_no}</td>
      <td>{row.article}</td>
      <td>{row.color_num}</td>
      <td>
        {editing ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            allowEmpty
            value={colorId}
            onChange={setColorId}
            options={colors.map((c) => ({ id: c.id, label: c.name }))}
          />
        ) : (
          label(colors, row.color_id)
        )}
      </td>
      <td>
        {editing ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            allowEmpty
            value={patternId}
            onChange={setPatternId}
            options={patterns.map((c) => ({ id: c.id, label: c.name }))}
          />
        ) : (
          label(patterns, row.pattern_id)
        )}
      </td>
      <td>
        {editing ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            allowEmpty
            value={contentId}
            onChange={setContentId}
            options={contents.map((c) => ({ id: c.id, label: c.name }))}
          />
        ) : (
          label(contents, row.content_id)
        )}
      </td>
      <td>
        {editing ? (
          <ComboBox
            className="rounded border px-1 py-0.5"
            allowEmpty
            value={brandId}
            onChange={setBrandId}
            options={brands.map((b) => ({ id: b.id, label: b.name }))}
          />
        ) : (
          row.brands?.name ?? "—"
        )}
      </td>
      <td>
        <RowButtons
          editing={editing}
          dirty={dirty}
          onEdit={requestEdit}
          onSave={() => void persist()}
          onCancel={requestCancel}
          onDelete={() => {
            if (!confirm(`Delete lot ${row.lot_no}?`)) return;
            start(async () => {
              const message = await deleteLot(row.id);
              if (message) setErr(message);
            });
          }}
        />
        {err ? <p className="text-xs text-red-700">{err}</p> : null}
        {pending ? <p className="text-xs text-stone-400">Working…</p> : null}
      </td>
    </SelectableRow>
  );
}
