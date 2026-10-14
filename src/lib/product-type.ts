export const PRODUCT_TYPE = {
  merchandise: 1,
  surcharge: 2,
  freight: 3,
} as const;

export type ProductType = 1 | 2 | 3;

export function productTypeLabel(type: number) {
  if (type === PRODUCT_TYPE.surcharge) return "Surcharge";
  if (type === PRODUCT_TYPE.freight) return "Freight";
  return "Merchandise";
}

export function productTitle(p: {
  type?: number | null;
  name?: string | null;
  lots?: { lot_no?: string } | null;
  models?: { name?: string; items?: { name?: string } | null } | null;
}) {
  if (p.name?.trim()) return p.name.trim();
  const type = p.type ?? PRODUCT_TYPE.merchandise;
  if (type !== PRODUCT_TYPE.merchandise) return productTypeLabel(type);
  const lot = (p.lots as { lot_no?: string } | null)?.lot_no;
  const model = p.models as { name?: string } | null;
  if (lot && model?.name) return `${lot}>${model.name}`;
  return model?.name ?? lot ?? "Product";
}

export function isMerchandise(type?: number | null) {
  return (type ?? PRODUCT_TYPE.merchandise) === PRODUCT_TYPE.merchandise;
}

export const PRICE_STAGE = {
  line: 1,
  promo: 2,
  closeOut: 3,
} as const;

export function priceStageLabel(stage?: number | null) {
  if (stage === PRICE_STAGE.promo) return "Promo";
  if (stage === PRICE_STAGE.closeOut) return "Close-out";
  return "Line";
}

export function isSpecialPriceStage(stage?: number | null) {
  return stage === PRICE_STAGE.promo || stage === PRICE_STAGE.closeOut;
}
