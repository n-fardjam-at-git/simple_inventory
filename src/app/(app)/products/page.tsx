import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PageTitle, Card } from "@/components/ui";

export default async function ProductsPage() {
  const profile = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, standard_price, published, lots ( lot_no ), models ( name, items ( name ) )",
    )
    .order("id");

  return (
    <div>
      <PageTitle
        title="Products"
        actions={
          profile.role === "admin" ? (
            <Link
              className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white"
              href="/products/new"
            >
              New product
            </Link>
          ) : null
        }
      />
      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="py-2">Lot</th>
              <th>Item / Model</th>
              <th>Line price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p) => {
              const lot = p.lots as unknown as { lot_no: string };
              const model = p.models as unknown as {
                name: string;
                items: { name: string };
              };
              return (
                <tr key={p.id} className="border-b border-stone-100">
                  <td className="py-2 font-medium">{lot?.lot_no}</td>
                  <td>
                    {model?.items?.name} · {model?.name}
                  </td>
                  <td>${Number(p.standard_price).toFixed(2)}</td>
                  <td>
                    <Link className="text-stone-700 underline" href={`/products/${p.id}`}>
                      Matrix
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
