import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { loadProductMatrix } from "@/lib/products";
import { QtyMatrix } from "@/components/matrix/QtyMatrix";
import { PageTitle, Card, Btn } from "@/components/ui";
import { postReceive } from "../../actions";

export default async function ReceivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { data: lines } = await supabase
    .from("cutting_order_products")
    .select("product_id")
    .eq("cutting_order_id", id);

  const matrices = [];
  for (const line of lines ?? []) {
    matrices.push(await loadProductMatrix(line.product_id));
  }

  return (
    <div>
      <PageTitle title="Cutting shipment" />
      <form action={postReceive.bind(null, id)} className="space-y-6">
        {matrices.map((m) => {
          const lot = m.product?.lots as unknown as { lot_no: string };
          const model = m.product?.models as unknown as { name: string };
          const empty = m.cells.map((c) => ({ ...c, qty: 0 }));
          return (
            <Card key={m.product?.id}>
              <h2 className="mb-2 font-medium">
                {lot?.lot_no} · {model?.name}
              </h2>
              <QtyMatrix
                sizes={m.sizes}
                drops={m.drops}
                cells={empty}
                editable
                namePrefix={`cell:${m.product?.id}`}
              />
            </Card>
          );
        })}
        <Btn type="submit">Post to inventory</Btn>
      </form>
    </div>
  );
}
