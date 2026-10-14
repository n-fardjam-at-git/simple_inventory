import { createClient } from "@/lib/supabase/server";
import { loadProductMatrix } from "@/lib/products";
import { QtyMatrix } from "@/components/matrix/QtyMatrix";
import { PageTitle, Card } from "@/components/ui";
import Link from "next/link";

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory")
    .select("product_id, qty_on_hand, reorder_point")
    .order("product_id");
  const lowIds = [
    ...new Set(
      (data ?? [])
        .filter((i) => i.qty_on_hand <= i.reorder_point)
        .map((i) => i.product_id),
    ),
  ];

  const matrices = [];
  for (const id of lowIds) {
    matrices.push(await loadProductMatrix(id));
  }

  return (
    <div>
      <PageTitle title="Low stock" />
      {matrices.length === 0 ? (
        <p className="text-sm text-stone-500">No cells at or below reorder point.</p>
      ) : null}
      <div className="space-y-6">
        {matrices.map((m) => {
          const lowCells = m.cells.map((c) => ({
            ...c,
            qty: c.qty,
          }));
          return (
            <Card key={m.product?.id}>
              <Link className="mb-2 block font-medium underline" href={`/products/${m.product?.id}`}>
                {m.product?.name}
              </Link>
              <QtyMatrix sizes={m.sizes} drops={m.drops} cells={lowCells} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
