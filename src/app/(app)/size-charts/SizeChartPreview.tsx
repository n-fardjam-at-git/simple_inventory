"use client";

import { QtyMatrix, type MatrixDrop, type MatrixSize } from "@/components/matrix/QtyMatrix";
import { NO_DROP_CODE } from "@/lib/size-code";

function dims(raw: string, prefix: string): MatrixSize[] | MatrixDrop[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((code, i) => ({ id: `${prefix}-${i}`, code, sort_order: i + 1 }));
}

export function SizeChartPreview({
  title,
  sizes,
  drops,
  onClose,
}: {
  title: string;
  sizes: string;
  drops: string;
  onClose: () => void;
}) {
  const sizeDims = dims(sizes, "s") as MatrixSize[];
  const parsedDrops = dims(drops, "d") as MatrixDrop[];
  const dropDims = parsedDrops.length
    ? parsedDrops
    : [{ id: "d-none", code: NO_DROP_CODE, sort_order: 1 }];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] max-w-[min(96vw,72rem)] overflow-auto rounded-lg bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 font-medium">{title}</p>
        {sizeDims.length === 0 ? (
          <p className="text-sm text-stone-500">Add sizes to see the chart.</p>
        ) : (
          <QtyMatrix sizes={sizeDims} drops={dropDims} cells={[]} />
        )}
      </div>
    </div>
  );
}
