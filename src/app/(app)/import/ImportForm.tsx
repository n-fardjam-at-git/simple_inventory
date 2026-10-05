"use client";

import { useState } from "react";
import { Btn } from "@/components/ui";

type Template = { id: string; name: string; target: string; mappings: unknown };

export function ImportForm({ templates }: { templates: Template[] }) {
  const [result, setResult] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheets, setSheets] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/import", { method: "POST", body: fd });
    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
  }

  async function peek(file: File) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    setSheets(wb.SheetNames);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    setHeaders(rows[0] ? Object.keys(rows[0]) : []);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm">
      <label className="block">
        Template
        <select name="template_id" required className="ml-2 rounded border px-2 py-1">
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.target})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Workbook
        <input
          className="ml-2"
          type="file"
          name="file"
          accept=".xlsx,.xls"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void peek(f);
          }}
        />
      </label>
      {sheets.length ? (
        <label className="block">
          Sheet
          <select name="sheet" className="ml-2 rounded border px-2 py-1">
            {sheets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {headers.length ? (
        <p className="text-stone-500">Headers: {headers.join(", ")}</p>
      ) : null}
      <Btn type="submit">Preview & import</Btn>
      {result ? (
        <pre className="overflow-auto rounded bg-stone-100 p-2 text-xs">{result}</pre>
      ) : null}
    </form>
  );
}
