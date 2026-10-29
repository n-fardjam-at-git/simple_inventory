import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth";
import { getCompanyName } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireUser();
  const tradeName = await getCompanyName();
  let submittedPackingLists = 0;
  if (profile.role === "admin" || profile.role === "warehouse") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("vendor_advices")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted");
    submittedPackingLists = count ?? 0;
  }
  return (
    <AppShell
      tradeName={tradeName}
      displayName={profile.display_name}
      role={profile.role}
      submittedPackingLists={submittedPackingLists}
    >
      {children}
    </AppShell>
  );
}
