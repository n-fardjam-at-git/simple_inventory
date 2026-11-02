"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toSentenceCase } from "@/lib/text-case";

function revalidateTerms() {
  revalidatePath("/payment-terms");
  revalidatePath("/customers");
}

function daysDue(raw: string) {
  const text = raw.trim();
  if (!text) return { days: null as number | null };
  if (!/^\d+$/.test(text)) return { error: "Days due is a whole number, or blank." as const };
  return { days: Number(text) };
}

export async function addPaymentTerm(formData: FormData) {
  const term = String(formData.get("term") ?? "").trim();
  if (!term) return "Enter a term.";
  const parsed = daysDue(String(formData.get("days_due") ?? ""));
  if ("error" in parsed) return parsed.error;
  const supabase = await createClient();
  const { error } = await supabase.from("payment_terms").insert({
    term,
    description: toSentenceCase(String(formData.get("description") || "").trim()) || null,
    days_due: parsed.days,
  });
  if (error?.code === "23505") return "That term already exists.";
  if (error) return error.message;
  revalidateTerms();
}

export async function updatePaymentTerm(
  id: string,
  values: { term: string; description: string; daysDue: string },
) {
  const term = values.term.trim();
  if (!term) return "Enter a term.";
  const parsed = daysDue(values.daysDue);
  if ("error" in parsed) return parsed.error;
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_terms")
    .update({
      term,
      description: toSentenceCase(values.description.trim()) || null,
      days_due: parsed.days,
    })
    .eq("id", id);
  if (error?.code === "23505") return "That term already exists.";
  if (error) return error.message;
  revalidateTerms();
}

export async function deletePaymentTerm(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("payment_terms").delete().eq("id", id);
  if (error?.code === "23503") return "This term is still on a customer.";
  if (error) return error.message;
  revalidateTerms();
}
