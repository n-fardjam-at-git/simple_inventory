import { cache } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { getCompanyName } from "@/lib/company";
import { safeFileName } from "@/lib/file-name";
import { ShopPreview, type PreviewProduct } from "./ShopPreview";

type Named = { name: string | null };
type Axis = { id: string; code: string; sort_order: number };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function previewFileName(customer: string) {
  return ["Preview", safeFileName(customer)].filter(Boolean).join(" - ");
}

const loadPreview = cache(async () => {
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
    const { data: owned } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    customerId = owned?.id ?? null;
  }
  if (!customerId) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("company_name")
    .eq("id", customerId)
    .maybeSingle();
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, standard_price, lots ( article, colors ( name ), patterns ( name ), contents ( name ) ), models ( name, items ( name ) )",
    )
    .eq("type", 1)
    .eq("is_active", true)
    .eq("published", true);
  const ids = (products ?? []).map((product) => product.id);
  const [{ data: sizeRows }, { data: dropRows }, { data: upRows }] = await Promise.all([
    ids.length
      ? supabase
          .from("product_sizes")
          .select("product_id, size_chart_sizes ( id, code, sort_order )")
          .in("product_id", ids)
      : Promise.resolve({ data: [] as { product_id: string; size_chart_sizes: unknown }[] }),
    ids.length
      ? supabase
          .from("product_drops")
          .select("product_id, size_chart_drops ( id, code, sort_order )")
          .in("product_id", ids)
      : Promise.resolve({ data: [] as { product_id: string; size_chart_drops: unknown }[] }),
    ids.length
      ? supabase
          .from("product_price_upcharges")
          .select("product_id, size_id, drop_id, upcharge_amount")
          .in("product_id", ids)
      : Promise.resolve({
          data: [] as {
            product_id: string;
            size_id: string;
            drop_id: string;
            upcharge_amount: number | null;
          }[],
        }),
  ]);

  const catalog: PreviewProduct[] = (products ?? []).map((product) => {
    const lot = one(product.lots) as {
      article: string | null;
      colors: Named | Named[] | null;
      patterns: Named | Named[] | null;
      contents: Named | Named[] | null;
    } | null;
    const model = one(product.models) as {
      name: string | null;
      items: Named | Named[] | null;
    } | null;
    const nameOf = (value: Named | Named[] | null | undefined) => one(value)?.name?.trim() || "";
    const fabric = [nameOf(lot?.colors), nameOf(lot?.patterns), nameOf(lot?.contents)]
      .filter(Boolean)
      .join(" ");
    const sizes = (sizeRows ?? [])
      .filter((row) => row.product_id === product.id)
      .map((row) => one(row.size_chart_sizes as Axis | Axis[] | null))
      .filter((size): size is Axis => Boolean(size))
      .sort((a, b) => a.sort_order - b.sort_order);
    const drops = (dropRows ?? [])
      .filter((row) => row.product_id === product.id)
      .map((row) => one(row.size_chart_drops as Axis | Axis[] | null))
      .filter((drop): drop is Axis => Boolean(drop))
      .sort((a, b) => a.sort_order - b.sort_order);
    const upcharges = (upRows ?? [])
      .filter((row) => row.product_id === product.id && Number(row.upcharge_amount) > 0)
      .map((row) => ({
        size_id: row.size_id,
        drop_id: row.drop_id,
        amount: Number(row.upcharge_amount),
      }));
    return {
      id: product.id,
      name: product.name?.trim() || model?.name?.trim() || "Product",
      price: Number(product.standard_price ?? 0),
      article: lot?.article?.trim() || null,
      model: model?.name?.trim() || null,
      item: nameOf(model?.items) || null,
      fabric: fabric || null,
      sizes,
      drops,
      upcharges,
    };
  });

  const customerName = customer?.company_name?.trim() || "";
  return {
    customerId,
    customer: customerName,
    company: await getCompanyName(),
    fileName: previewFileName(customerName),
    products: catalog,
  };
});

export async function generateMetadata(): Promise<Metadata> {
  const preview = await loadPreview();
  return { title: preview?.fileName ?? "Preview" };
}

export default async function ShopPreviewPage() {
  const preview = await loadPreview();
  if (!preview) {
    return <p className="text-sm text-stone-600">Your login is not linked to a customer.</p>;
  }
  return <ShopPreview {...preview} />;
}
