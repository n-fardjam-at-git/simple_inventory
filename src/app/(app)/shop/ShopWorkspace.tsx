"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Btn, PageTitle } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { FitList, FitPage } from "@/components/list/FitList";
import { SelectableRow } from "@/components/list/ListTable";
import { ProductThumb, type ProductPhoto } from "@/components/ProductThumb";
import { SysAddToCart, SysCart } from "@/components/icons/SysImages";
import { addCartToRequest, createRequestFromCart } from "../my-orders/actions";

export type ShopProduct = {
  id: string;
  name: string;
  price: number;
  color: string | null;
  images: ProductPhoto[];
};

export type DraftOrder = { id: string; request_no: number };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function cartKey(customerId: string) {
  return `shop-cart:${customerId}`;
}

function isId(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export function ShopWorkspace({
  customerId,
  products,
  drafts,
}: {
  customerId: string;
  products: ShopProduct[];
  drafts: DraftOrder[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"new" | "add" | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(cartKey(customerId));
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    setCart(Array.isArray(ids) ? ids.filter((id) => products.some((product) => product.id === id)) : []);
    setReady(true);
  }, [customerId, products]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(cartKey(customerId), JSON.stringify(cart));
  }, [ready, customerId, cart]);

  const inCart = new Set(cart);
  const chosen = cart
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is ShopProduct => Boolean(product));

  function finish(result: string) {
    if (!isId(result)) {
      setErr(result);
      return;
    }
    setCart([]);
    setOpen(false);
    router.push(`/my-orders?open=${result}`);
    router.refresh();
  }

  function createOrder() {
    if (busy) return;
    setBusy("new");
    start(async () => {
      try {
        finish(await createRequestFromCart(cart));
      } finally {
        setBusy(null);
      }
    });
  }

  function addToOrder() {
    if (busy || !draftId) return;
    setBusy("add");
    start(async () => {
      try {
        finish(await addCartToRequest(draftId, cart));
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <>
      <FitPage>
      <PageTitle
        className="mb-0"
        title="Shop"
        actions={
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-2"
            aria-label={cart.length ? `Cart, ${cart.length}` : "Cart"}
            title="Cart"
            onClick={() => setOpen(true)}
          >
            <SysCart />
            {cart.length ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-stone-900 px-1.5 text-xs font-medium text-white tabular-nums">
                {cart.length}
              </span>
            ) : null}
          </button>
        }
      />
      <FitList
        items={products}
        getKey={(product) => product.id}
        stretch
        thead={
          <thead>
            <tr className="text-stone-500">
              <th className="py-1">Product</th>
              <th className="w-24 py-1">Price</th>
              <th className="w-36 py-1"></th>
            </tr>
          </thead>
        }
        renderRow={(product) => {
          const added = inCart.has(product.id);
          return (
            <SelectableRow id={product.id}>
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <ProductThumb title={product.name} images={product.images} reserve />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{product.name}</p>
                    {product.color ? <p className="text-xs text-stone-500">{product.color}</p> : null}
                  </div>
                </div>
              </td>
              <td className="tabular-nums">{usd.format(product.price)}</td>
              <td className="py-1">
                <button
                  type="button"
                  className="inline-flex cursor-pointer disabled:cursor-default disabled:opacity-40"
                  disabled={added}
                  aria-label={added ? "In cart" : "Add to cart"}
                  title={added ? "In cart" : "Add to cart"}
                  onClick={() =>
                    setCart((current) => (current.includes(product.id) ? current : [...current, product.id]))
                  }
                >
                  <SysAddToCart />
                </button>
              </td>
            </SelectableRow>
          );
        }}
      />
      </FitPage>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4">
              <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setOpen(false)} />
              <div className="relative z-10 flex max-h-[80vh] w-[min(32rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
                  <h2 className="text-sm font-medium">Cart</h2>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-lg leading-none text-stone-500 hover:bg-stone-100"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
                  {err ? (
                    <DismissNote className="text-xs text-red-700" onDismiss={() => setErr(null)}>
                      {err}
                    </DismissNote>
                  ) : null}
                  {chosen.length ? (
                    <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200">
                      {chosen.map((product) => (
                        <li key={product.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                          <span className="min-w-0 flex-1 truncate">{product.name}</span>
                          <span className="tabular-nums text-stone-500">{usd.format(product.price)}</span>
                          <button
                            type="button"
                            className="px-1 text-base leading-none text-stone-500 hover:text-stone-800"
                            aria-label={`Remove ${product.name}`}
                            onClick={() => setCart((current) => current.filter((id) => id !== product.id))}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-stone-500">The cart is empty.</p>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <Btn type="button" busy={busy === "new"} disabled={!chosen.length || pending} onClick={createOrder}>
                      New order
                    </Btn>
                    {drafts.length ? (
                      <>
                        <label className="min-w-40 flex-1">
                          <span className="mb-1 block text-xs text-stone-500">Open order</span>
                          <ComboBox
                            allowEmpty
                            placeholder="Order"
                            className="w-full rounded border py-1 pr-6 pl-2"
                            value={draftId}
                            onChange={setDraftId}
                            options={drafts.map((draft) => ({
                              id: draft.id,
                              label: `Order ${draft.request_no}`,
                            }))}
                          />
                        </label>
                        <Btn
                          type="button"
                          busy={busy === "add"}
                          disabled={!chosen.length || !draftId || pending}
                          onClick={addToOrder}
                        >
                          Add to this order
                        </Btn>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
