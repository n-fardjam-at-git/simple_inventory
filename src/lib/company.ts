import { createClient } from "@/lib/supabase/server";

export async function getCompanyName() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return "Gruppo Bravo";
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_profile")
    .select("trade_name")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();
  return data?.trade_name ?? "Gruppo Bravo";
}
