import { loadProductMatrix } from "@/lib/products";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMerchandise, productTitle, productTypeLabel } from "@/lib/product-type";
import { ProductSettingsEditor } from "./ProductSettingsEditor";

export default async function ProductSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; edit?: string }>;
}) {
  const { id } = await params;
  const { notice, edit } = await searchParams;
  const profile = await requireUser();
  const { product, sizes, drops, cells } = await loadProductMatrix(id);
  if (!product) return <p>Not found</p>;
  const type = product.type ?? 1;
  const merch = isMerchandise(type);
  const lot = product.lots as unknown as {
    lot_no: string;
    brands: { name: string } | null;
  };
  const model = product.models as unknown as {
    name: string;
    items: { name: string };
    size_chart_id: string;
  };
  const title = productTitle({
    type,
    name: product.name,
    lots: lot,
    models: model,
  });
  const supabase = await createClient();
  const { data: chartSizes } = merch && product.size_chart_id
    ? await supabase
        .from("size_chart_sizes")
        .select("id, code, sort_order")
        .eq("chart_id", product.size_chart_id)
        .order("sort_order")
    : { data: [] as { id: string; code: string; sort_order: number }[] };
  const { data: chartDrops } = merch && product.size_chart_id
    ? await supabase
        .from("size_chart_drops")
        .select("id, code, sort_order")
        .eq("chart_id", product.size_chart_id)
        .order("sort_order")
    : { data: [] as { id: string; code: string; sort_order: number }[] };
  const selectedSizes = new Set(sizes.map((s) => s.id));
  const selectedDrops = new Set(drops.map((d) => d.id));
  const admin = profile.role === "admin";
  const banner =
    notice === "exists" ? (
      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        This lot and model already exist as a product. You were opened here instead of creating a duplicate.
      </p>
    ) : null;
  const priceText = `$${Number(product.standard_price).toFixed(2)}`;
  const meta = (
    <p className="text-sm text-stone-600">
      {merch
        ? `${lot?.brands?.name ?? ""} ${model?.items?.name ?? ""} • ${title}  ${priceText}`.replace(
            /^\s+/,
            "",
          )
        : `${productTypeLabel(type)}  ${priceText}`}
    </p>
  );

  if (admin) {
    return (
      <div className="space-y-6">
        <ProductSettingsEditor
          title={title}
          productId={id}
          merch={merch}
          standardPrice={Number(product.standard_price)}
          sizes={sizes}
          drops={drops}
          cells={cells}
          chartSizes={chartSizes ?? []}
          chartDrops={chartDrops ?? []}
          selectedSizeIds={[...selectedSizes]}
          selectedDropIds={[...selectedDrops]}
          resumeListEdit={edit === "1"}
        >
          {banner}
          {meta}
        </ProductSettingsEditor>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle title={title} />
      {banner}
      {meta}
    </div>
  );
}
