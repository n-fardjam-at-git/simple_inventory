import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { productImageUrl } from "@/lib/product-images";
import type { ProductPhoto } from "@/components/ProductThumb";
import { ShopWorkspace, type DraftOrder, type ShopProduct } from "./ShopWorkspace";

type Named = { name: string };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function ShopPage() {
  await requireRoles(["customer"]);
  const supabase = await createClient();
  const { data: profile } = await supabase.auth.getUser();
  const userId = profile.user?.id;
  if (!userId) redirect("/login");
  const { data: login } = await supabase
    .from("profiles")
    .select("customer_id")
    .eq("id", userId)
    .maybeSingle();
  let customerId = (login?.customer_id as string | null) ?? null;
  if (!customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    customerId = customer?.id ?? null;
  }
  if (!customerId) {
    return (
      <p className="text-sm text-stone-600">Your login is not linked to a customer.</p>
    );
  }

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, standard_price, availability, lots ( brands ( name ), colors ( name ), patterns ( name ), contents ( name ) ), models ( items ( name ) )",
    )
    .eq("type", 1)
    .eq("is_active", true)
    .eq("published", true)
    .order("name");
  const ids = (products ?? []).map((product) => product.id);
  const { data: imageRows } = ids.length
    ? await supabase
        .from("product_images")
        .select("product_id, src_path, thumb_path, sort_order")
        .in("product_id", ids)
        .order("sort_order")
    : { data: [] };
  const imagesByProduct = new Map<string, ProductPhoto[]>();
  for (const row of imageRows ?? []) {
    const src = productImageUrl(row.src_path);
    if (!src) continue;
    const list = imagesByProduct.get(row.product_id) ?? [];
    list.push({ src, thumb: productImageUrl(row.thumb_path) || src });
    imagesByProduct.set(row.product_id, list);
  }
  const catalog: ShopProduct[] = (products ?? []).map((product) => {
    const lot = one(product.lots) as {
      brands: Named | Named[] | null;
      colors: Named | Named[] | null;
      patterns: Named | Named[] | null;
      contents: Named | Named[] | null;
    } | null;
    const model = one(product.models) as { items: Named | Named[] | null } | null;
    const nameOf = (value: Named | Named[] | null | undefined) => one(value)?.name?.trim() || null;
    return {
      id: product.id,
      name: product.name?.trim() || "Product",
      price: Number(product.standard_price ?? 0),
      brand: nameOf(lot?.brands),
      item: nameOf(model?.items),
      pattern: nameOf(lot?.patterns),
      color: nameOf(lot?.colors),
      content: nameOf(lot?.contents),
      availability: product.availability?.trim() || null,
      images: imagesByProduct.get(product.id) ?? [],
    };
  });
  const { data: drafts } = await supabase
    .from("customer_order_requests")
    .select("id, request_no")
    .eq("customer_id", customerId)
    .eq("status", "draft")
    .order("request_no", { ascending: false });

  return (
    <ShopWorkspace
      customerId={customerId}
      products={catalog}
      drafts={(drafts ?? []) as DraftOrder[]}
    />
  );
}
