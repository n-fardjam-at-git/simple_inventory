import { requireRoles } from "@/lib/auth";
import { PickListWorkspace } from "./PickListWorkspace";

/** The pick list is kept in the browser for this login, so the page loads no rows itself. */
export default async function PickListPage() {
  const profile = await requireRoles(["admin", "warehouse"]);
  return (
    <div>
      <PickListWorkspace userId={profile.id} />
    </div>
  );
}
