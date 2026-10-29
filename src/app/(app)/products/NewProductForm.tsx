"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { UpchargeMatrix, type Cell } from "@/components/matrix/QtyMatrix";
import {
  CreateFromTemplatePopup,
  type ProductTemplateStamp,
} from "./CreateFromTemplatePopup";

type Lot = { id: string; lot_no: string; brand_id?: string | null };
type Model = {
  id: string;
  name: string;
  size_chart_id: string;
  item_id?: string | null;
  items: unknown;
};
type Dim = { id: string; code: string; chart_id: string; sort_order?: number };

const field = "w-full rounded border border-stone-300 px-2 py-1";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1 block text-stone-500">{label}</span>
      {children}
    </label>
  );
}

export function NewProductForm({
  kind,
  lots = [],
  models = [],
  sizes = [],
  drops = [],
  seasons = [],
  collections = [],
  templates = [],
}: {
  kind: "merchandise" | "charge";
  lots?: Lot[];
  models?: Model[];
  sizes?: Dim[];
  drops?: Dim[];
  seasons?: SeasonRow[];
  collections?: { id: string; name: string }[];
  templates?: ProductTemplateStamp[];
}) {
  const [type, setType] = useState<number>(
    kind === "merchandise" ? PRODUCT_TYPE.merchandise : PRODUCT_TYPE.surcharge,
  );
  const merch = kind === "merchandise";
  const [name, setName] = useState("");
  const [priceStage, setPriceStage] = useState<number>(PRICE_STAGE.line);
  const [availability, setAvailability] = useState<string | null>(null);
  const [lotId, setLotId] = useState("");
  const [modelId, setModelId] = useState("");
  const [tplOpen, setTplOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [sizeIds, setSizeIds] = useState<string[]>([]);
  const [dropIds, setDropIds] = useState<string[]>([]);
  const [upCells, setUpCells] = useState<Cell[]>([]);
  const [matrixKey, setMatrixKey] = useState(0);
  const [price, setPrice] = useState(0);
  const [priceKey, setPriceKey] = useState(0);
  const chartId = models.find((m) => m.id === modelId)?.size_chart_id ?? "";
  const chartSizes = sizes
    .filter((s) => s.chart_id === chartId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const chartDrops = drops
    .filter((d) => d.chart_id === chartId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const noDrop = isNoDropAxis(chartDrops);
  const shownDrops = noDrop ? chartDrops : visibleDrops(chartDrops);
  const brandId = lots.find((l) => l.id === lotId)?.brand_id ?? "";
  const itemId = models.find((m) => m.id === modelId)?.item_id ?? "";
  const canFromTemplate = Boolean(lotId && modelId && brandId && itemId && chartId);
  const matchingTemplates = templates.filter(
    (t) => t.brand_id === brandId && t.item_id === itemId && t.size_chart_id === chartId,
  );
  const matrixSizes = chartSizes.filter((s) => sizeIds.includes(s.id));
  const matrixDrops = shownDrops.filter((d) => dropIds.includes(d.id));

  useEffect(() => {
    setSizeIds(chartSizes.map((s) => s.id));
    setDropIds(shownDrops.map((d) => d.id));
    setTemplateId("");
    setUpCells([]);
    setMatrixKey((k) => k + 1);
  }, [chartId]);

  function pasteTemplate(tpl: ProductTemplateStamp) {
    setTemplateId(tpl.id);
    setPrice(tpl.standard_price);
    setPriceKey((k) => k + 1);
    setSizeIds(tpl.size_ids);
    setDropIds(noDrop ? shownDrops.map((d) => d.id) : tpl.drop_ids);
    setUpCells(
      tpl.upcharges.map((u) => ({
        size_id: u.size_id,
        drop_id: u.drop_id,
        qty: 0,
        upcharge: u.amount,
      })),
    );
    setMatrixKey((k) => k + 1);
    setTplOpen(false);
  }

  if (!merch) {
    return (
      <form action={createProduct} className="max-w-md space-y-4 text-sm">
        <Field label="Type">
          <select
            name="type"
            className={field}
            value={type}
            onChange={(e) => setType(Number(e.target.value))}
          >
            <option value={PRODUCT_TYPE.surcharge}>Surcharge</option>
            <option value={PRODUCT_TYPE.freight}>Freight</option>
          </select>
        </Field>
        <Field label="Name">
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
            className={field}
          />
        </Field>
        <Field label="Cost">
          <PriceInput key={priceKey} name="standard_price" defaultValue={price} className={field} />
        </Field>
        <input type="hidden" name="price_stage" value={PRICE_STAGE.line} />
        {type === PRODUCT_TYPE.freight ? (
          <p className="text-stone-500">
            There is only one freight product. Quantity on a shipment is always 1 (total shipping
            cost).
          </p>
        ) : (
          <p className="text-stone-500">
            Surcharge quantity is set on each shipment (for example 2 × below minimum).
          </p>
        )}
        <div className="flex items-center gap-3">
          <Btn type="submit">Create</Btn>
          <Link
            href="/products/charges"
            className="rounded border border-stone-300 px-3 py-1.5 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    );
  }

  return (
    <form action={createProduct} className="space-y-8 text-sm">
      <input type="hidden" name="type" value={PRODUCT_TYPE.merchandise} />
      {templateId ? <input type="hidden" name="template_id" value={templateId} /> : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-medium">Product</h2>
          {canFromTemplate ? (
            <button
              type="button"
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
              onClick={() => setTplOpen(true)}
            >
              Create from template
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lot">
            <ComboBox
              name="lot_id"
              required
              placeholder="Lot"
              className={field}
              value={lotId}
              onChange={(id) => {
                setLotId(id);
                setTplOpen(false);
              }}
              options={lots.map((l) => ({ id: l.id, label: l.lot_no }))}
            />
          </Field>
          <Field label="Model">
            <ComboBox
              name="model_id"
              required
              placeholder="Model"
              className={field}
              value={modelId}
              onChange={(id) => {
                setModelId(id);
                setTplOpen(false);
              }}
              options={models.map((m) => {
                const item = Array.isArray(m.items) ? m.items[0] : m.items;
                const itemName = (item as { name?: string } | null)?.name;
                return { id: m.id, label: itemName ? `${itemName} · ${m.name}` : m.name };
              })}
            />
          </Field>
          <Field label="Collection">
            <ComboBox
              name="collection_id"
              allowEmpty
              placeholder="Collection"
              className={field}
              options={collections.map((c) => ({ id: c.id, label: c.name }))}
            />
          </Field>
        </div>
        {tplOpen ? (
          <CreateFromTemplatePopup
            templates={matchingTemplates}
            onClose={() => setTplOpen(false)}
            onPaste={pasteTemplate}
          />
        ) : null}
      </section>

      <section className="space-y-3 border-t border-stone-200 pt-6">
        <h2 className="font-medium">Selling</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Price">
            <PriceInput
              key={priceKey}
              name="standard_price"
              defaultValue={price}
              className={field}
            />
          </Field>
          <div>
            <p className="mb-1 text-stone-500">Price stage</p>
            <PriceStageRadios value={priceStage} onChange={setPriceStage} />
          </div>
          <div>
            <p className="mb-1 text-stone-500">Availability</p>
            <AvailabilityPicker
              seasons={seasons}
              value={availability}
              onChange={setAvailability}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-stone-200 pt-6">
        <h2 className="font-medium">{noDrop ? "Size subset" : "Size / drop subset"}</h2>
        {chartId ? (
          <>
            <p className="text-xs text-stone-500">
              Check sizes{noDrop ? "" : " and drops"} from the model chart. Uncheck those not on
              this product.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-stone-500">Sizes</p>
                <div className="flex flex-wrap gap-2">
                  {chartSizes.map((s) => (
                    <label key={s.id} className="inline-flex items-center">
                      <input
                        className="mr-1"
                        type="checkbox"
                        name="size_id"
                        value={s.id}
                        checked={sizeIds.includes(s.id)}
                        onChange={() => {
                          setSizeIds((prev) =>
                            prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                          );
                        }}
                      />
                      {s.code}
                    </label>
                  ))}
                </div>
              </div>
              {noDrop ? (
                chartDrops.map((d) => (
                  <input key={d.id} type="hidden" name="drop_id" value={d.id} />
                ))
              ) : (
                <div>
                  <p className="mb-1 text-stone-500">Drops</p>
                  <div className="flex flex-wrap gap-2">
                    {shownDrops.map((d) => (
                      <label key={d.id} className="inline-flex items-center">
                        <input
                          className="mr-1"
                          type="checkbox"
                          name="drop_id"
                          value={d.id}
                          checked={dropIds.includes(d.id)}
                          onChange={() => {
                            setDropIds((prev) =>
                              prev.includes(d.id)
                                ? prev.filter((id) => id !== d.id)
                                : [...prev, d.id],
                            );
                          }}
                        />
                        {d.code}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-stone-500">Pick a model to choose sizes.</p>
        )}
      </section>

      <section className="space-y-3 border-t border-stone-200 pt-6">
        <h2 className="font-medium text-teal-900">Size upcharges</h2>
        <p className="text-xs text-teal-800/80">
          Extra dollars on the line price for that size × drop. Leave blank for none.
        </p>
        {chartId && matrixSizes.length && matrixDrops.length ? (
          <UpchargeMatrix
            key={`${chartId}-${matrixKey}`}
            sizes={matrixSizes.map((s) => ({ ...s, sort_order: s.sort_order ?? 0 }))}
            drops={matrixDrops.map((d) => ({ ...d, sort_order: d.sort_order ?? 0 }))}
            cells={upCells}
          />
        ) : (
          <p className="text-xs text-stone-500">
            {chartId ? "Check sizes to set upcharges." : "Pick a model to set upcharges."}
          </p>
        )}
      </section>

      <div className="flex items-center gap-3 border-t border-stone-200 pt-6">
        <Btn type="submit">Create</Btn>
        <Link
          href="/products"
          className="rounded border border-stone-300 px-3 py-1.5 text-sm"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
