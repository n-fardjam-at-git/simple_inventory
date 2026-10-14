"use client";

import { PRICE_STAGE, isSpecialPriceStage, priceStageLabel } from "@/lib/product-type";

const OPTIONS = [PRICE_STAGE.line, PRICE_STAGE.promo, PRICE_STAGE.closeOut] as const;

export function PriceStageRadios({
  name = "price_stage",
  value,
  onChange,
}: {
  name?: string;
  value: number;
  onChange: (stage: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {OPTIONS.map((stage) => (
        <label
          key={stage}
          className={isSpecialPriceStage(stage) ? "text-red-700" : "text-stone-800"}
        >
          <input
            type="radio"
            className="mr-1"
            name={name}
            value={stage}
            checked={value === stage}
            onChange={() => onChange(stage)}
          />
          {priceStageLabel(stage)}
        </label>
      ))}
    </div>
  );
}
