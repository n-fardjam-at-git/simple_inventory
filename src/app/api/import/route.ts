import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyMappings, readSheetHeadersAndRows, type Mapping } from "@/lib/excel/parse";
import { toSentenceCase } from "@/lib/text-case";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const templateId = String(form.get("template_id"));
  const sheet = String(form.get("sheet") || "");
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const { data: template } = await supabase
    .from("import_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (!template) return NextResponse.json({ error: "template not found" }, { status: 404 });

  const buffer = await file.arrayBuffer();
  const parsed = readSheetHeadersAndRows(buffer, sheet || undefined);
  const mappings = (template.mappings as Mapping[]) ?? [];
  const mapped = applyMappings(parsed.rows, mappings);
  const created: string[] = [];
  const updated: string[] = [];
  const failed: { row: number; reason: string }[] = [];

  if (template.target === "customers") {
    for (let i = 0; i < mapped.length; i++) {
      const row = mapped[i];
      const name = toSentenceCase(row.company_name?.trim() ?? "");
      const sage = row.account_number?.trim() || null;
      if (!name && !sage) {
        failed.push({ row: i + 2, reason: "empty" });
        continue;
      }
      let existing = null;
      if (sage) {
        const { data } = await supabase
          .from("customers")
          .select("id")
          .eq("account_number", sage)
          .maybeSingle();
        existing = data;
      }
      if (!existing && name) {
        const { data } = await supabase
          .from("customers")
          .select("id")
          .eq("company_name", name)
          .maybeSingle();
        existing = data;
      }
      if (existing) {
        const { error } = await supabase
          .from("customers")
          .update({ company_name: name || undefined, account_number: sage })
          .eq("id", existing.id);
        if (error) failed.push({ row: i + 2, reason: error.message });
        else updated.push(existing.id);
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert({ company_name: name || "Imported", account_number: sage })
          .select("id")
          .single();
        if (error) failed.push({ row: i + 2, reason: error.message });
        else created.push(data.id);
      }
    }
  } else {
    for (let i = 0; i < mapped.length; i++) {
      const row = mapped[i];
      const sage = row.account_number?.trim();
      const name = toSentenceCase(row.company_name?.trim() ?? "");
      let customer = null;
      if (sage) {
        const { data } = await supabase
          .from("customers")
          .select("id")
          .eq("account_number", sage)
          .maybeSingle();
        customer = data;
      }
      if (!customer && name) {
        const { data } = await supabase
          .from("customers")
          .select("id")
          .eq("company_name", name)
          .maybeSingle();
        customer = data;
      }
      if (!customer) {
        failed.push({ row: i + 2, reason: "no matching customer" });
        continue;
      }
      const type = (row.address_type || "shipping").toLowerCase();
      const address_type = ["shipping", "billing", "both"].includes(type)
        ? type
        : "shipping";
      const { error } = await supabase.from("customer_addresses").insert({
        customer_id: customer.id,
        address_type,
        label: row.label || null,
        address_line1: row.address_line1 || null,
        address_line2: row.address_line2 || null,
        city: row.city || null,
        region: row.region || null,
        postal_code: row.postal_code || null,
        country: row.country || null,
      });
      if (error) failed.push({ row: i + 2, reason: error.message });
      else created.push(customer.id);
    }
  }

  return NextResponse.json({
    sheet: parsed.sheet,
    headers: parsed.headers,
    created: created.length,
    updated: updated.length,
    failed,
  });
}
