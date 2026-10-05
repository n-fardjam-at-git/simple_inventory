import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth";
import { getCompanyName } from "@/lib/company";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireUser();
  const tradeName = await getCompanyName();
  return (
    <AppShell
      tradeName={tradeName}
      displayName={profile.display_name}
      role={profile.role}
    >
      {children}
    </AppShell>
  );
}
