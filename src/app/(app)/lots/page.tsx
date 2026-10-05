import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Card, Btn } from "@/components/ui";
import { addLot } from "../models-actions";

export default async function LotsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data: lots } = await supabase
    .from("lots")
    .select("id, lot_no, article, color_num, brands ( name )")
    .order("lot_no");
  const { data: brands } = await supabase.from("brands").select("id, name");
  return (
    <div>
      <PageTitle title="Lot numbers" />
      <Card>
        <table className="mb-4 w-full text-left text-sm">
          <thead>
            <tr className="text-stone-500">
              <th className="py-1">Lot No</th>
              <th>Article</th>
              <th>Color</th>
              <th>Brand</th>
            </tr>
          </thead>
          <tbody>
            {(lots ?? []).map((l) => {
              const brand = l.brands as unknown as { name: string } | null;
              return (
                <tr key={l.id} className="border-t border-stone-100">
                  <td className="py-1 font-medium">{l.lot_no}</td>
                  <td>{l.article}</td>
                  <td>{l.color_num}</td>
                  <td>{brand?.name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <form action={addLot} className="flex flex-wrap gap-2 text-sm">
          <input name="lot_no" required placeholder="M40901-1" className="rounded border px-2 py-1" />
          <select name="brand_id" className="rounded border px-2 py-1">
            <option value="">Brand</option>
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Btn type="submit">Add</Btn>
        </form>
      </Card>
    </div>
  );
}
