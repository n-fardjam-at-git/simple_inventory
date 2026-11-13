import { isNoDropAxis } from "@/lib/size-code";
import type { MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Inventory size/drop grid. A green box marks a cell with on-hand quantity. No counts. */
export function AvailableSizesMatrix({
  sizes,
  drops,
  cells,
  upcharges,
}: {
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: { size_id: string; drop_id: string }[];
  upcharges: { size_id: string; drop_id: string; amount: number }[];
}) {
  const sortedSizes = [...sizes].sort((a, b) => a.sort_order - b.sort_order);
  const sortedDrops = [...drops].sort((a, b) => a.sort_order - b.sort_order);
  const hideDrop = isNoDropAxis(sortedDrops);
  const on = new Set(cells.map((cell) => `${cell.size_id}:${cell.drop_id}`));
  const extra = new Map(upcharges.map((row) => [`${row.size_id}:${row.drop_id}`, row.amount]));
  const pad = "px-1 py-0.5";

  if (!sortedSizes.length || !sortedDrops.length) {
    return <p className="text-sm text-stone-500">No sizes.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            {hideDrop ? null : (
              <th className={`border border-stone-200 bg-stone-100 ${pad} text-left font-medium`}>Drop</th>
            )}
            {sortedSizes.map((size) => (
              <th
                key={size.id}
                className={`border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-center font-medium`}
              >
                {size.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedDrops.map((drop) => (
            <tr key={drop.id}>
              {hideDrop ? null : (
                <th className={`border border-stone-200 bg-stone-50 ${pad} text-left font-medium`}>{drop.code}</th>
              )}
              {sortedSizes.map((size) => {
                const key = `${size.id}:${drop.id}`;
                const available = on.has(key);
                const amount = extra.get(key) ?? 0;
                return (
                  <td
                    key={size.id}
                    className={`border border-stone-200 ${available && amount > 0 ? "bg-green-100" : "bg-white"} ${pad} text-center`}
                  >
                    {amount > 0 ? (
                      <span className="text-[0.85em] font-medium text-red-700 tabular-nums">
                        +{usd.format(amount)}
                      </span>
                    ) : (
                      <span
                        className={`inline-block h-4 w-4 rounded-sm ${available ? "bg-green-600" : ""}`}
                        aria-label={available ? "Available" : undefined}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
