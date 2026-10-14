"use client";

import { INSTOCK, sortSeasonsDesc, type SeasonRow } from "@/lib/season";
import { ComboBox } from "@/components/ComboBox";

export function AvailabilityPicker({
  seasons,
  value,
  onChange,
  formFields = true,
}: {
  seasons: SeasonRow[];
  value: string | null;
  onChange: (next: string | null) => void;
  formFields?: boolean;
}) {
  const instock = value === INSTOCK;
  const ordered = sortSeasonsDesc(seasons);

  return (
    <div className="space-y-2">
      {formFields ? <input type="hidden" name="availability" value={value ?? ""} /> : null}
      <label className="inline-flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={instock}
          onChange={(e) => onChange(e.target.checked ? INSTOCK : null)}
        />
        Instock
      </label>
      {instock ? null : (
        <ComboBox
          className="block rounded border px-2 py-1"
          placeholder="Season"
          allowEmpty
          value={value ?? ""}
          onChange={(id) => onChange(id || null)}
          options={ordered.map((s) => ({ id: s.season, label: s.season }))}
        />
      )}
    </div>
  );
}
