import { requireUser } from "@/lib/auth";
import { loadChargeProducts } from "@/lib/products";
import { ChargesList } from "./ChargesList";

export default async function InventoryChargesPage() {
  await requireUser();
  const rows = await loadChargeProducts();
  if (rows.length === 0) {
    return <p className="text-sm text-stone-500">No surcharge or freight products yet.</p>;
  }
  return <ChargesList rows={rows} />;
}
