import * as XLSX from "xlsx";

export type Mapping = {
  dest_field: string;
  source_header: string;
  is_link?: boolean;
};

export function readSheetHeadersAndRows(buffer: ArrayBuffer, sheetName?: string) {
  const wb = XLSX.read(buffer, { type: "array" });
  const name = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { sheetNames: wb.SheetNames, sheet: name, headers, rows };
}

export function applyMappings(
  rows: Record<string, unknown>[],
  mappings: Mapping[],
) {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const m of mappings) {
      if (!m.source_header) continue;
      const key = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === m.source_header.trim().toLowerCase(),
      );
      out[m.dest_field] = key ? String(row[key] ?? "").trim() : "";
    }
    return out;
  });
}

export const CUSTOMER_FIELDS = [
  "company_name",
  "account_number",
] as const;

export const ADDRESS_FIELDS = [
  "account_number",
  "company_name",
  "address_type",
  "label",
  "address_line1",
  "address_line2",
  "city",
  "region",
  "postal_code",
  "country",
] as const;
