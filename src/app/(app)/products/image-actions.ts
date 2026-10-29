"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  cleanImagePath,
  pathFromImageUrl,
  productImageOrigin,
  productImageUrl,
} from "@/lib/product-images";

export type ProductImageView = {
  id: string;
  src: string;
  thumb: string;
  srcPath: string;
};

export type CatalogImage = {
  srcPath: string;
  thumbPath: string | null;
  src: string;
  thumb: string;
};

export type CatalogHit = {
  id: number;
  name: string;
  sku: string;
  images: CatalogImage[];
};

type ImageRow = {
  id: string;
  src_path: string;
  thumb_path: string | null;
  sort_order: number;
};

function viewOf(row: ImageRow): ProductImageView | null {
  const src = productImageUrl(row.src_path);
  if (!src) return null;
  return {
    id: row.id,
    src,
    thumb: productImageUrl(row.thumb_path) || src,
    srcPath: row.src_path,
  };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Sign in required." as string | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { supabase, error: "Admin only." };
  return { supabase, error: null };
}

export async function loadProductImages(
  productId: string,
): Promise<{ images: ProductImageView[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images")
    .select("id, src_path, thumb_path, sort_order")
    .eq("product_id", productId)
    .order("sort_order");
  if (error) {
    const missing = /product_images/i.test(error.message);
    return {
      images: [],
      error: missing ? "Run the product images SQL (0045) in the database." : error.message,
    };
  }
  return {
    images: ((data ?? []) as ImageRow[]).map(viewOf).filter((img): img is ProductImageView => img != null),
    error: productImageOrigin() ? null : "Set PRODUCT_IMAGE_ORIGIN to the photo site.",
  };
}

export async function searchCatalogImages(
  query: string,
): Promise<{ hits: CatalogHit[]; error: string | null }> {
  const gate = await requireAdmin();
  if (gate.error) return { hits: [], error: gate.error };
  const origin = productImageOrigin();
  if (!origin) return { hits: [], error: "Set PRODUCT_IMAGE_ORIGIN to the photo site." };
  const q = query.trim();
  if (!q) return { hits: [], error: "Enter a lot or product name." };

  let response: Response;
  try {
    response = await fetch(
      `${origin}/wp-json/wc/store/v1/products?search=${encodeURIComponent(q)}&per_page=20`,
      { cache: "no-store" },
    );
  } catch {
    return { hits: [], error: "Could not reach the photo site." };
  }
  if (!response.ok) return { hits: [], error: "The photo site did not return products." };

  const body = (await response.json()) as {
    id?: number;
    name?: string;
    sku?: string;
    images?: { src?: string; thumbnail?: string }[];
  }[];
  if (!Array.isArray(body)) return { hits: [], error: "The photo site returned an unexpected list." };

  const hits: CatalogHit[] = [];
  for (const product of body) {
    const images: CatalogImage[] = [];
    for (const image of product.images ?? []) {
      const srcPath = pathFromImageUrl(String(image.src ?? ""), origin);
      if (!srcPath) continue;
      const thumbPath = pathFromImageUrl(String(image.thumbnail ?? ""), origin);
      const src = productImageUrl(srcPath);
      images.push({
        srcPath,
        thumbPath,
        src,
        thumb: productImageUrl(thumbPath) || src,
      });
    }
    if (!images.length) continue;
    hits.push({
      id: Number(product.id),
      name: String(product.name ?? "Product"),
      sku: String(product.sku ?? ""),
      images,
    });
  }
  return { hits, error: hits.length ? null : "No photos matched." };
}

export async function saveProductImages(
  productId: string,
  draft: { id: string | null; srcPath: string; thumbPath: string | null }[],
): Promise<string | null> {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;
  const { data: product } = await supabase
    .from("products")
    .select("id, type")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.type !== 1) return "Merchandise only.";

  const cleaned: { id: string | null; srcPath: string; thumbPath: string | null }[] = [];
  for (const image of draft) {
    const srcPath = cleanImagePath(image.srcPath);
    if (!srcPath || cleaned.some((row) => row.srcPath === srcPath)) continue;
    cleaned.push({ id: image.id, srcPath, thumbPath: cleanImagePath(image.thumbPath) });
  }

  const { data: existing, error: existingErr } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId);
  if (existingErr) return existingErr.message;

  const fresh = cleaned.filter((row) => !row.id);
  let inserted: { id: string; src_path: string }[] = [];
  if (fresh.length) {
    const { data, error } = await supabase
      .from("product_images")
      .insert(
        fresh.map((row, index) => ({
          product_id: productId,
          src_path: row.srcPath,
          thumb_path: row.thumbPath,
          sort_order: index + 1,
        })),
      )
      .select("id, src_path");
    if (error) return error.message;
    inserted = data ?? [];
  }

  const keep = new Set(cleaned.map((row) => row.id).filter((id): id is string => Boolean(id)));
  const removeIds = (existing ?? []).map((row) => row.id).filter((id) => !keep.has(id));
  if (removeIds.length) {
    const { error } = await supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId)
      .in("id", removeIds);
    if (error) return error.message;
  }

  const insertedByPath = new Map(inserted.map((row) => [row.src_path, row.id]));
  for (let index = 0; index < cleaned.length; index += 1) {
    const id = cleaned[index].id ?? insertedByPath.get(cleaned[index].srcPath);
    if (!id) continue;
    const { error } = await supabase
      .from("product_images")
      .update({ sort_order: index + 1 })
      .eq("id", id)
      .eq("product_id", productId);
    if (error) return error.message;
  }

  revalidatePath("/inventory");
  revalidatePath("/products");
  return null;
}
