"use client";

import { useMemo, useState } from "react";
import { Btn } from "@/components/ui";
import { saveTemplate } from "./actions";
import { ADDRESS_FIELDS, CUSTOMER_FIELDS } from "@/lib/excel/parse";
import { ComboBox } from "@/components/ComboBox";

export function TemplateEditor({
  templates,
}: {
  templates: { id: string; name: string; target: string; mappings: unknown }[];
}) {
  const [target, setTarget] = useState<"customers" | "customer_addresses">("customers");
  const fields = target === "customers" ? CUSTOMER_FIELDS : ADDRESS_FIELDS;
  const [headers, setHeaders] = useState<string[]>([]);

  const defaultMaps = useMemo(
    () =>
      fields.map((f) => ({
        dest_field: f,
        source_header: "",
        is_link: f === "account_number",
      })),
    [fields],
  );
  const [maps, setMaps] = useState(defaultMaps);

  async function onFile(file: File) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const hdrs = rows[0] ? Object.keys(rows[0]) : [];
    setHeaders(hdrs);
  }

  return (
    <div className="space-y-4 text-sm">
      <form action={saveTemplate} className="space-y-3">
        <input name="name" required aria-label="Template name" className="rounded border px-2 py-1" />
        <select
          name="target"
          value={target}
          onChange={(e) => {
            const t = e.target.value as "customers" | "customer_addresses";
            setTarget(t);
            const fs = t === "customers" ? CUSTOMER_FIELDS : ADDRESS_FIELDS;
            setMaps(
              fs.map((f) => ({
                dest_field: f,
                source_header: "",
                is_link: f === "account_number" || f === "company_name",
              })),
            );
          }}
          className="ml-2 rounded border px-2 py-1"
        >
          <option value="customers">customers</option>
          <option value="customer_addresses">customer_addresses</option>
        </select>
        <div>
          <p className="mb-1 text-stone-500">Optional: upload a sample sheet to pick source headers</p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-stone-500">
              <th>Destination</th>
              <th>Source header</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {maps.map((m, i) => (
              <tr key={m.dest_field}>
                <td className="py-1">{m.dest_field}</td>
                <td>
                  {headers.length ? (
                    <ComboBox
                      className="rounded border px-1 py-1"
                      allowEmpty
                      value={m.source_header}
                      onChange={(id) => {
                        const next = [...maps];
                        next[i] = { ...m, source_header: id };
                        setMaps(next);
                      }}
                      options={headers.map((h) => ({ id: h, label: h }))}
                    />
                  ) : (
                    <input
                      className="rounded border px-1 py-1"
                      value={m.source_header}
                      onChange={(e) => {
                        const next = [...maps];
                        next[i] = { ...m, source_header: e.target.value };
                        setMaps(next);
                      }}
                      aria-label="Excel column header"
                    />
                  )}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!m.is_link}
                    onChange={(e) => {
                      const next = [...maps];
                      next[i] = { ...m, is_link: e.target.checked };
                      setMaps(next);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <input type="hidden" name="mappings" value={JSON.stringify(maps)} />
        <Btn type="submit">Save template</Btn>
      </form>
      <div>
        <h3 className="mb-1 font-medium">Saved</h3>
        <ul>
          {templates.map((t) => (
            <li key={t.id}>
              {t.name} → {t.target}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
