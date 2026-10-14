"use client";

import { useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui";
import { PriceInput } from "@/components/PriceInput";
import { createProduct } from "./actions";
import { PRICE_STAGE, PRODUCT_TYPE } from "@/lib/product-type";
import { PriceStageRadios } from "@/components/PriceStageRadios";
import { AvailabilityPicker } from "@/components/AvailabilityPicker";
import { type SeasonRow } from "@/lib/season";
import { toSentenceCase } from "@/lib/text-case";
import { ComboBox } from "@/components/ComboBox";
import { isNoDropAxis, visibleDrops } from "@/lib/size-code";

type Lot = { id: string; lot_no: string };
type Model = { id: string; name: string; size_chart_id: string; items: unknown };
type Dim = { id: string; code: string; chart_id: string; sort_order?: number };

export function NewProductForm({
  kind,
  lots = [],
  models = [],
  sizes = [],
  drops = [],
  seasons = [],
  collections = [],
}: {
  kind: "merchandise" | "charge";
  lots?: Lot[];
  models?: Model[];
  sizes?: Dim[];
  drops?: Dim[];
  seasons?: SeasonRow[];
  collections?: { id: string; name: string }[];
}) {
  const [type, setType] = useState<number>(
    kind === "merchandise" ? PRODUCT_TYPE.merchandise : PRODUCT_TYPE.surcharge,
  );
  const merch = kind === "merchandise";
  const [name, setName] = useState("");
  const [priceStage, setPriceStage] = useState<number>(PRICE_STAGE.line);
  const [availability, setAvailability] = useState<string | null>(null);
  const [modelId, setModelId] = useState("");
  const chartId = models.find((m) => m.id === modelId)?.size_chart_id ?? "";
  const chartSizes = sizes
    .filter((s) => s.chart_id === chartId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const chartDrops = drops
    .filter((d) => d.chart_id === chartId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <form action={createProduct} className="space-y-4 text-sm">
      {merch ? (
        <input type="hidden" name="type" value={PRODUCT_TYPE.merchandise} />
      ) : (
        <label className="block">
          Type
          <select
            name="type"
            className="ml-2 rounded border px-2 py-1"
            value={type}
            onChange={(e) => setType(Number(e.target.value))}
          >
            <option value={PRODUCT_TYPE.surcharge}>Surcharge</option>
            <option value={PRODUCT_TYPE.freight}>Freight</option>
          </select>
        </label>
      )}

      {merch ? (
        <>
          <label className="block">
            Lot
            <ComboBox
              name="lot_id"
              required
              placeholder="Lot"
              className="ml-2 rounded border px-2 py-1"
              options={lots.map((l) => ({ id: l.id, label: l.lot_no }))}
            />
          </label>
          <label className="block">
            Model
            <ComboBox
              name="model_id"
              required
              placeholder="Model"
              className="ml-2 rounded border px-2 py-1"
              value={modelId}
              onChange={setModelId}
              options={models.map((m) => {
                const item = Array.isArray(m.items) ? m.items[0] : m.items;
                const itemName = (item as { name?: string } | null)?.name;
                return { id: m.id, label: itemName ? `${itemName} · ${m.name}` : m.name };
              })}
            />
          </label>
          <label className="block">
            Collection
            <ComboBox
              name="collection_id"
              allowEmpty
              placeholder="Collection"
              className="ml-2 rounded border px-2 py-1"
              options={collections.map((c) => ({ id: c.id, label: c.name }))}
            />
          </label>
        </>
      ) : (
        <label className="block">
          Name
          <input
            name="name"
            type="text"
            required
            spellCheck
            autoCorrect="on"
            autoCapitalize="sentences"
            lang="en"
            value={name}
            onChange={(e) => setName(toSentenceCase(e.target.value))}
            className="ml-2 rounded border px-2 py-1"
          />
        </label>
      )}

      <label className="block">
        {merch ? "Price" : "Cost"}
        <PriceInput
          name="standard_price"
          defaultValue={0}
          className="ml-2 rounded border px-2 py-1"
        />
      </label>

      {merch ? (
        <>
          <div>
            <p className="mb-1">Price stage</p>
            <PriceStageRadios value={priceStage} onChange={setPriceStage} />
          </div>
          <div>
            <p className="mb-1">Availability</p>
            <AvailabilityPicker
              seasons={seasons}
              value={availability}
              onChange={setAvailability}
            />
          </div>
        </>
      ) : (
        <input type="hidden" name="price_stage" value={PRICE_STAGE.line} />
      )}

      {merch ? (
        <>
          <p className="text-stone-500">
            Check sizes{isNoDropAxis(chartDrops) ? "" : " and drops"} from the model chart.
            Uncheck those not on this product.
          </p>
          <div key={`sizes-${chartId}`}>
            <p className="mb-1 font-medium">Sizes</p>
            <div className="flex flex-wrap gap-2">
              {chartSizes.map((s) => (
                <label key={s.id}>
                  <input className="mr-1" type="checkbox" name="size_id" value={s.id} defaultChecked />
                  {s.code}
                </label>
              ))}
            </div>
          </div>
          {isNoDropAxis(chartDrops) ? (
            chartDrops.map((d) => (
              <input key={d.id} type="hidden" name="drop_id" value={d.id} />
            ))
          ) : (
            <div key={`drops-${chartId}`}>
              <p className="mb-1 font-medium">Drops</p>
              <div className="flex flex-wrap gap-2">
                {visibleDrops(chartDrops).map((d) => (
                  <label key={d.id}>
                    <input className="mr-1" type="checkbox" name="drop_id" value={d.id} defaultChecked />
                    {d.code}
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      ) : type === PRODUCT_TYPE.freight ? (
        <p className="text-stone-500">
          There is only one freight product. Quantity on a shipment is always 1 (total shipping cost).
        </p>
      ) : (
        <p className="text-stone-500">
          Surcharge quantity is set on each shipment (for example 2 × below minimum).
        </p>
      )}
      <div className="flex items-center gap-3">
        <Btn type="submit">Create</Btn>
        <Link
          href={merch ? "/products" : "/products/charges"}
          className="rounded border border-stone-300 px-3 py-1.5 text-sm"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
