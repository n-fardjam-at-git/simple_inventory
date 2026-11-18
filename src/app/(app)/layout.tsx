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
  let submittedOrderRequests = 0;
  const packing = profile.role === "admin" || profile.role === "warehouse";
  const drafts = packing || profile.role === "sales_rep";
  if (packing || drafts) {
    const supabase = await createClient();
    const [packingCount, draftCount] = await Promise.all([
      packing
        ? supabase
            .from("vendor_advices")
            .select("id", { count: "exact", head: true })
            .eq("status", "submitted")
        : Promise.resolve({ count: 0 }),
      drafts
        ? supabase
            .from("customer_order_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "submitted")
        : Promise.resolve({ count: 0 }),
    ]);
    submittedPackingLists = packingCount.count ?? 0;
    submittedOrderRequests = draftCount.count ?? 0;
  }
  return (
    <AppShell
      tradeName={tradeName}
      displayName={profile.display_name}
      role={profile.role}
      submittedPackingLists={submittedPackingLists}
      submittedOrderRequests={submittedOrderRequests}
    >
      {children}
    </AppShell>
  );
}
