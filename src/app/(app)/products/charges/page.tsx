import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ProductsTable } from "../ProductsTable";

export default async function ProductChargesPage() {
  const profile = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, type, name, standard_price, published, is_active, lots ( lot_no ), models ( name, items ( name ) )",
    )
    .in("type", [2, 3])
    .order("type")
    .order("name");

  const rows = (data ?? []).map((p) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    standard_price: Number(p.standard_price),
    is_active: p.is_active,
    lots: p.lots as { lot_no: string } | null,
    models: p.models as { name: string; items: { name: string } | null } | null,
  }));

  const canEdit = profile.role === "admin";

  return (
    <div>
      {canEdit ? (
        <div className="mb-2 flex justify-end">
          <Link
            className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white"
            href="/products/charges/new"
          >
            New charge
          </Link>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">No surcharge or freight products yet.</p>
      ) : (
        <ProductsTable rows={rows} canEdit={canEdit} showType />
      )}
    </div>
  );
}
