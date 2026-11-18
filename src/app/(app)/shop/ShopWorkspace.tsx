"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { Busy } from "@/components/WorkingBeside";
import { DismissNote } from "@/components/DismissNote";
import { FitList, FitPage } from "@/components/list/FitList";
import { SelectableRow } from "@/components/list/ListTable";
import { ProductThumb, type ProductPhoto } from "@/components/ProductThumb";
import { SysAddToCart, SysCart } from "@/components/icons/SysImages";
import { addCartToRequest, createRequestFromCart, type RequestHeaderInput } from "../my-orders/actions";
import type { SeasonRow } from "@/lib/season";
import type { RequestAddress } from "../my-orders/types";
import { PostOrderPopup } from "./PostOrderPopup";
import { AvailableSizesPopup } from "./AvailableSizesPopup";
import { ShopQtyPopup } from "./ShopQtyPopup";
import { cartKey, readCart, type CartLine } from "./cart";

export type ShopProduct = {
  id: string;
  name: string;
  price: number;
  brand: string | null;
  item: string | null;
  pattern: string | null;
  color: string | null;
  content: string | null;
  availability: string | null;
  images: ProductPhoto[];
};

export type DraftOrder = { id: string; request_no: number };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function isId(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export function ShopWorkspace({
  customerId,
  products,
  drafts,
  seasons,
  addresses,
}: {
  customerId: string;
  products: ShopProduct[];
  drafts: DraftOrder[];
  seasons: SeasonRow[];
  addresses: RequestAddress[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"new" | "add" | null>(null);
  const [sizesFor, setSizesFor] = useState<ShopProduct | null>(null);
  const [qtyFor, setQtyFor] = useState<ShopProduct | null>(null);
  const [postOpen, setPostOpen] = useState(false);

  useEffect(() => {
    setCart(
      readCart(
        window.localStorage.getItem(cartKey(customerId)),
        new Set(products.map((product) => product.id)),
      ),
    );
    setReady(true);
  }, [customerId, products]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(cartKey(customerId), JSON.stringify(cart));
  }, [ready, customerId, cart]);

  const inCart = new Set(cart.map((line) => line.productId));
  const chosen = cart
    .map((line) => products.find((product) => product.id === line.productId))
    .filter((product): product is ShopProduct => Boolean(product));

  function finish(result: string) {
    if (!isId(result)) {
      setErr(result);
      return;
    }
    setCart([]);
    router.push(`/my-orders?open=${result}`);
    router.refresh();
  }

  async function postOrder(header: RequestHeaderInput) {
    if (busy) return "Wait for the current order to finish.";
    setBusy("new");
    try {
      const result = await createRequestFromCart(cart, header);
      if (!isId(result)) return result;
      setPostOpen(false);
      finish(result);
      return null;
    } finally {
      setBusy(null);
    }
  }

  function addToOrder() {
    const targetId = drafts.length === 1 ? drafts[0].id : draftId;
    if (busy || !targetId) return;
    setBusy("add");
    start(async () => {
      try {
        finish(await addCartToRequest(targetId, cart));
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <FitPage>
      <PageTitle className="mb-0" title="Shop" />
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 w-2/3 min-w-0 flex-col">
          <FitList
            items={products}
            getKey={(product) => product.id}
            stretch
            thead={
              <thead>
                <tr className="text-stone-500">
                  <th className="py-1">Product</th>
                  <th className="w-24 py-1">Price</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
            }
            renderRow={(product) => {
              const added = inCart.has(product.id);
              const detail = [product.brand, product.item, product.pattern, product.color, product.content]
                .filter(Boolean)
                .join(" · ");
              return (
                <SelectableRow id={product.id}>
                  <td className="py-1.5">
                    <div className="flex items-start gap-2">
                      <ProductThumb title={product.name} images={product.images} reserve />
                      <div className="min-w-0">
                        <p className="font-medium">{product.name}</p>
                        {detail ? (
                          <p className="text-xs font-light leading-tight text-stone-500">{detail}</p>
                        ) : null}
                        {product.availability ? (
                          <p className="text-xs font-light leading-tight text-red-700">{product.availability}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="tabular-nums">{usd.format(product.price)}</td>
                  <td className="py-1 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSizesFor(product);
                        }}
                      >
                        Available sizes
                      </button>
                      <button
                        type="button"
                        className={`inline-flex cursor-pointer ${added ? "opacity-40" : ""}`}
                        aria-label={added ? "Change sizes" : "Add to cart"}
                        title={added ? "Change sizes" : "Add to cart"}
                        onClick={(event) => {
                          event.stopPropagation();
                          setQtyFor(product);
                        }}
                      >
                        <SysAddToCart />
                      </button>
                    </div>
                  </td>
                </SelectableRow>
              );
            }}
          />
        </div>
        <div className="flex min-h-0 w-1/3 min-w-0 flex-col overflow-hidden rounded-lg border border-stone-300 bg-[#f8f5e8] p-3">
          <div className="relative flex h-12 shrink-0 items-center overflow-hidden rounded-lg border border-[#FDE68A]/60 bg-[linear-gradient(135deg,#F59E0B,#D97706)] pr-3 pl-1 shadow-[0_1px_2px_rgba(217,119,6,0.28)]">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
            <h2 className="sr-only">Cart</h2>
            <SysCart bare className="relative" />
            {chosen.length ? (
              <span className="relative ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-medium text-white tabular-nums ring-1 ring-white/40">
                {chosen.length}
              </span>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto py-3">
            {err ? (
              <DismissNote className="mb-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
                {err}
              </DismissNote>
            ) : null}
            {chosen.length ? (
              <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200">
                {chosen.map((product) => (
                  <li key={product.id} className="flex items-center gap-2 bg-white px-2 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{product.name}</span>
                    <span className="tabular-nums text-stone-500">{usd.format(product.price)}</span>
                    <button
                      type="button"
                      className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                      onClick={() => setQtyFor(product)}
                    >
                      Sizes
                    </button>
                    <button
                      type="button"
                      className="px-1 text-base leading-none text-stone-500 hover:text-stone-800"
                      aria-label={`Remove ${product.name}`}
                      onClick={() =>
                        setCart((current) => current.filter((line) => line.productId !== product.id))
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-500">The cart is empty.</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
            <button
              type="button"
              disabled={!chosen.length || pending || busy === "new"}
              onClick={() => setPostOpen(true)}
              className="relative h-11 overflow-hidden rounded-lg border border-[#FDE68A]/60 bg-[linear-gradient(135deg,#F59E0B,#D97706)] px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(217,119,6,0.28)] disabled:opacity-40"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
              <span className="relative">Post order</span>
            </button>
            {drafts.length ? (
              <>
                {drafts.length > 1 ? (
                  <select
                    className="h-11 rounded-lg border border-stone-300 bg-white px-2 text-sm"
                    value={draftId}
                    aria-label="Open order"
                    onChange={(event) => setDraftId(event.target.value)}
                  >
                    <option value="">Order</option>
                    {drafts.map((draft) => (
                      <option key={draft.id} value={draft.id}>
                        Order {draft.request_no}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Busy on={busy === "add"} side="right">
                  <button
                    type="button"
                    disabled={!chosen.length || pending || busy === "add" || (drafts.length > 1 && !draftId)}
                    onClick={addToOrder}
                    className="relative h-11 overflow-hidden rounded-lg border border-[#FDE68A]/60 bg-[linear-gradient(135deg,#F59E0B,#D97706)] px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(217,119,6,0.28)] disabled:opacity-40"
                  >
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
                    <span className="relative">Add to open order</span>
                  </button>
                </Busy>
              </>
            ) : null}
            <button
              type="button"
              disabled={!chosen.length}
              onClick={() => {
                window.localStorage.setItem(cartKey(customerId), JSON.stringify(cart));
                window.open("/shop/preview", "_blank", "noopener");
              }}
              className="h-11 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 disabled:opacity-40"
            >
              Preview order
            </button>
          </div>
        </div>
      </div>
      {sizesFor ? (
        <AvailableSizesPopup product={sizesFor} onClose={() => setSizesFor(null)} />
      ) : null}
      {postOpen ? (
        <PostOrderPopup
          seasons={seasons}
          addresses={addresses}
          posting={busy === "new"}
          onPost={postOrder}
          onClose={() => setPostOpen(false)}
        />
      ) : null}
      {qtyFor ? (
        <ShopQtyPopup
          product={qtyFor}
          cells={cart.find((line) => line.productId === qtyFor.id)?.cells ?? []}
          onAdd={(cells) => {
            setCart((current) => {
              const index = current.findIndex((line) => line.productId === qtyFor.id);
              const line = { productId: qtyFor.id, cells };
              if (index < 0) return [...current, line];
              const next = [...current];
              next[index] = line;
              return next;
            });
            setQtyFor(null);
          }}
          onClose={() => setQtyFor(null)}
        />
      ) : null}
    </FitPage>
  );
}
