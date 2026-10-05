export type MatrixSize = { id: string; code: string; sort_order: number };
export type MatrixDrop = { id: string; code: string; sort_order: number };

export type Cell = {
  size_id: string;
  drop_id: string;
  qty: number;
  upcharge?: number | null;
};

export function QtyMatrix({
  sizes,
  drops,
  cells,
  editable = false,
  namePrefix,
}: {
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
  editable?: boolean;
  namePrefix?: string;
}) {
  const sortedSizes = [...sizes].sort((a, b) => a.sort_order - b.sort_order);
  const sortedDrops = [...drops].sort((a, b) => a.sort_order - b.sort_order);
  const lookup = new Map(
    cells.map((c) => [`${c.size_id}:${c.drop_id}`, c]),
  );

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-stone-200 bg-stone-100 px-2 py-1 text-left">Drop \\ Size</th>
            {sortedSizes.map((s) => (
              <th key={s.id} className="border border-stone-200 bg-stone-100 px-3 py-1">
                {s.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedDrops.map((d) => (
            <tr key={d.id}>
              <th className="border border-stone-200 bg-stone-50 px-2 py-1 text-left font-medium">
                {d.code}
              </th>
              {sortedSizes.map((s) => {
                const cell = lookup.get(`${s.id}:${d.id}`);
                const qty = cell?.qty ?? 0;
                const up = cell?.upcharge ?? 0;
                return (
                  <td key={s.id} className="border border-stone-200 px-2 py-1 text-center">
                    {editable ? (
                      <input
                        className="w-16 rounded border border-stone-300 px-1 py-0.5 text-center"
                        type="number"
                        min={0}
                        name={`${namePrefix ?? "cell"}:${s.id}:${d.id}`}
                        defaultValue={qty}
                      />
                    ) : (
                      <span className="inline-flex items-start justify-center gap-0.5">
                        <span className="font-medium">{qty}</span>
                        {up > 0 ? (
                          <sup className="text-[10px] font-semibold text-amber-700 leading-none">
                            +{up}
                          </sup>
                        ) : null}
                      </span>
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

export function UpchargeMatrix({
  sizes,
  drops,
  cells,
}: {
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
}) {
  const sortedSizes = [...sizes].sort((a, b) => a.sort_order - b.sort_order);
  const sortedDrops = [...drops].sort((a, b) => a.sort_order - b.sort_order);
  const lookup = new Map(cells.map((c) => [`${c.size_id}:${c.drop_id}`, c]));
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-stone-200 bg-stone-100 px-2 py-1">Drop \\ Size</th>
            {sortedSizes.map((s) => (
              <th key={s.id} className="border border-stone-200 bg-stone-100 px-3 py-1">
                {s.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedDrops.map((d) => (
            <tr key={d.id}>
              <th className="border border-stone-200 bg-stone-50 px-2 py-1 text-left">{d.code}</th>
              {sortedSizes.map((s) => {
                const cell = lookup.get(`${s.id}:${d.id}`);
                return (
                  <td key={s.id} className="border border-stone-200 px-1 py-1">
                    <input
                      className="w-16 rounded border border-stone-300 px-1 py-0.5 text-center"
                      type="number"
                      min={0}
                      step="0.01"
                      name={`up:${s.id}:${d.id}`}
                      defaultValue={cell?.upcharge ?? 0}
                    />
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
