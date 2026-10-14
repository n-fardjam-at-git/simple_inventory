import { setIsActive } from "@/app/(app)/catalog-actions";

type ActiveTable =
  | "products"
  | "customers"
  | "models"
  | "lots"
  | "brands"
  | "items"
  | "vendors"
  | "colors"
  | "patterns"
  | "contents"
  | "collections";

export function ActiveToggle({
  table,
  id,
  isActive,
}: {
  table: ActiveTable;
  id: string;
  isActive: boolean;
}) {
  return (
    <form action={setIsActive.bind(null, table, id)}>
      <input type="hidden" name="is_active" value={isActive ? "false" : "true"} />
      <button type="submit" className="text-xs text-stone-600 underline">
        {isActive ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}
