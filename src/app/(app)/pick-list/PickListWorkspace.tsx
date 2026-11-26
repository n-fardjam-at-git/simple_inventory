"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { DismissNote } from "@/components/DismissNote";
import { FitList, FitPage } from "@/components/list/FitList";
import { SelectableRow, useList } from "@/components/list/ListTable";
import { readPickBack, usePickList } from "@/components/pick/usePickList";
import { PageTitle } from "@/components/ui";
import { WorkingBeside } from "@/components/WorkingBeside";
import { orderStatusLabel } from "@/lib/customer-order";
import {
  isShippableOrder,
  pickedOrderIds,
  removeOrders,
  removePick,
  type PickBack,
  type PickList,
} from "@/lib/pick-list";
import { PRODUCT_TYPE } from "@/lib/product-type";
import {
  createShipmentFromPicks,
  loadPickOrders,
  type PickData,
  type PickLineInfo,
  type PickOrderInfo,
} from "./actions";

type BranchProduct = { line: PickLineInfo; problem: string | null };
type BranchOrder = { order: PickOrderInfo; problem: string | null; products: BranchProduct[] };

/** One customer and one set of main properties. A branch becomes one shipment. */
type Branch = {
  key: string;
  customer_id: string;
  customer: string;
  /** The first order, for the ship-to, bill-to, terms, shipping method, and sales rep. */
  head: PickOrderInfo;
  orders: BranchOrder[];
};

type LineItem =
  | { kind: "order"; id: string; entry: BranchOrder }
  | { kind: "product"; id: string; order: PickOrderInfo; product: BranchProduct };

const BUTTON =
  "rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50";

/** Why a picked line can no longer ship, or null. */
function lineProblem(line: PickLineInfo) {
  if (line.status !== "pending" && line.status !== "back_order") {
    return `Line is ${orderStatusLabel(line.status).toLowerCase()}`;
  }
  // On a shipment that has not shipped. It cannot go on a second one.
  if (line.picking) return "Already on a shipment";
  if (line.left_to_ship <= 0) {
    return line.type === PRODUCT_TYPE.merchandise ? "Nothing left to ship" : "Already on a shipment";
  }
  return null;
}

function buildBranches(list: PickList, data: PickData): Branch[] {
  const orderById = new Map(data.orders.map((order) => [order.id, order]));
  const lineByKey = new Map(data.lines.map((line) => [`${line.order_id}:${line.product_id}`, line]));
  const byKey = new Map<string, Branch>();
  for (const customer of list) {
    for (const picked of customer.orders) {
      const order = orderById.get(picked.order_id);
      if (!order) continue;
      const products = picked.products
        .flatMap((productId) => {
          const line = lineByKey.get(`${order.id}:${productId}`);
          return line ? [{ line, problem: lineProblem(line) }] : [];
        })
        .sort(
          (a, b) =>
            a.line.type - b.line.type ||
            a.line.label.localeCompare(b.line.label, "en", { sensitivity: "base" }),
        );
      if (!products.length) continue;
      const key = `${order.customer_id}|${order.ship_key}`;
      const branch = byKey.get(key) ?? {
        key,
        customer_id: order.customer_id,
        customer: order.customer,
        head: order,
        orders: [],
      };
      branch.orders.push({
        order,
        problem: isShippableOrder(order.status)
          ? null
          : `Order is ${orderStatusLabel(order.status).toLowerCase()}`,
        products,
      });
      byKey.set(key, branch);
    }
  }
  const branches = [...byKey.values()];
  for (const branch of branches) {
    branch.orders.sort((a, b) => a.order.order_no - b.order.order_no);
    branch.head = branch.orders[0].order;
  }
  return branches.sort(
    (a, b) =>
      a.customer.localeCompare(b.customer, "en", { sensitivity: "base" }) ||
      a.head.ship_to.join(" ").localeCompare(b.head.ship_to.join(" "), "en", { sensitivity: "base" }),
  );
}

function branchProductCount(branch: Branch) {
  return branch.orders.reduce((sum, entry) => sum + entry.products.length, 0);
}

function branchHasProblem(branch: Branch) {
  return branch.orders.some(
    (entry) => entry.problem || entry.products.some((product) => product.problem),
  );
}

function backHref(back: PickBack | null) {
  if (!back) return "/customer-orders";
  const product = back.product_id ? `&product=${encodeURIComponent(back.product_id)}` : "";
  return `/customer-orders?order=${encodeURIComponent(back.order_id)}${product}`;
}

export function PickListWorkspace({ userId }: { userId: string }) {
  const { list, ready, update } = usePickList(userId);
  const [data, setData] = useState<(PickData & { forIds: string }) | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [branchKey, setBranchKey] = useState<string | null>(null);
  const [lineBack, setLineBack] = useState<PickBack | null>(null);
  const [lastBack, setLastBack] = useState<PickBack | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; shipment_no: number } | null>(null);

  const idsKey = useMemo(() => [...new Set(pickedOrderIds(list))].sort().join(","), [list]);

  useEffect(() => {
    setLastBack(readPickBack(userId));
  }, [userId]);

  // The pick list keeps ids only. The orders and what is left to ship are read as they are now.
  useEffect(() => {
    if (!ready) return;
    if (!idsKey) {
      setData({ orders: [], lines: [], forIds: "" });
      setLoadErr(null);
      return;
    }
    let alive = true;
    void loadPickOrders(idsKey.split(",")).then((result) => {
      if (!alive) return;
      if ("error" in result) {
        setLoadErr(result.error);
        return;
      }
      setLoadErr(null);
      setData({ ...result, forIds: idsKey });
    });
    return () => {
      alive = false;
    };
  }, [ready, idsKey, reload]);

  // An order that was deleted, or a product taken off its order, leaves the pick list.
  useEffect(() => {
    if (!data || data.forIds !== idsKey || !idsKey) return;
    const orders = new Set(data.orders.map((order) => order.id));
    const lines = new Set(data.lines.map((line) => `${line.order_id}:${line.product_id}`));
    const gone = list.some((customer) =>
      customer.orders.some(
        (order) =>
          !orders.has(order.order_id) ||
          order.products.some((productId) => !lines.has(`${order.order_id}:${productId}`)),
      ),
    );
    if (!gone) return;
    update((current) =>
      current
        .map((customer) => ({
          customer_id: customer.customer_id,
          orders: customer.orders
            .filter((order) => orders.has(order.order_id))
            .map((order) => ({
              order_id: order.order_id,
              products: order.products.filter((productId) =>
                lines.has(`${order.order_id}:${productId}`),
              ),
            }))
            .filter((order) => order.products.length > 0),
        }))
        .filter((customer) => customer.orders.length > 0),
    );
  }, [data, idsKey, list, update]);

  const branches = useMemo(() => (data ? buildBranches(list, data) : []), [list, data]);
  const branch = branches.find((item) => item.key === branchKey) ?? null;

  const onBranchSelect = useCallback((key: string | null) => {
    setBranchKey(key);
    setLineBack(null);
    setErr(null);
  }, []);

  async function createShipment() {
    if (!branch || creating) return;
    if (branchHasProblem(branch)) {
      setErr("Take the red lines off first.");
      return;
    }
    setErr(null);
    setCreated(null);
    setCreating(true);
    try {
      const result = await createShipmentFromPicks(
        branch.customer_id,
        branch.orders.flatMap((entry) =>
          entry.products.map((product) => ({
            order_id: entry.order.id,
            product_id: product.line.product_id,
          })),
        ),
      );
      if ("error" in result) {
        setErr(result.error);
        // Something changed since the list was read. Read it again so the line shows red.
        setReload((n) => n + 1);
        return;
      }
      setCreated(result);
      update((current) =>
        removeOrders(
          current,
          branch.orders.map((entry) => entry.order.id),
        ),
      );
    } finally {
      setCreating(false);
    }
  }

  function removeBranch() {
    if (!branch) return;
    if (!confirm(`Remove ${branch.customer || "this customer"} from the pick list?`)) return;
    update((current) =>
      removeOrders(
        current,
        branch.orders.map((entry) => entry.order.id),
      ),
    );
  }

  function clear() {
    if (!confirm("Clear the pick list?")) return;
    setCreated(null);
    setErr(null);
    update(() => []);
  }

  const loading = !ready || data === null || data.forIds !== idsKey;

  return (
    <FitPage>
      <PageTitle
        title="Pick list"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={backHref(lineBack ?? lastBack)}
              className={BUTTON}
              title="Back to the product in Customer orders"
            >
              Back
            </Link>
            {list.length ? (
              <button type="button" className={BUTTON} onClick={clear}>
                Clear
              </button>
            ) : null}
          </div>
        }
      />
      {loadErr ? (
        <DismissNote className="shrink-0 text-xs text-red-700" onDismiss={() => setLoadErr(null)}>
          {loadErr}
        </DismissNote>
      ) : null}
      {created ? (
        <p className="shrink-0 text-sm text-stone-700">
          Shipment No {created.shipment_no} was created.{" "}
          <Link className="underline" href={`/customer-shipments?shipment=${created.id}`}>
            Open the shipment
          </Link>
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 w-1/2 min-w-0 flex-col">
          <FitList
            items={branches}
            getKey={(item) => item.key}
            stretch
            thead={
              <thead>
                <SelectionBridge onSelect={onBranchSelect} />
                <tr className="text-stone-500">
                  <th className="py-1">Customer</th>
                  <th>Ship to</th>
                  <th>Orders</th>
                  <th>Products</th>
                </tr>
              </thead>
            }
            renderRow={(item) => <BranchRow branch={item} />}
          />
        </div>
        <div className="flex min-h-0 w-1/2 min-w-0 flex-col overflow-hidden rounded-lg border border-stone-300 bg-white p-3">
          {branch ? (
            <>
              <div className="flex h-[39px] shrink-0 items-end justify-between gap-3 border-b border-stone-300 pb-1">
                <h2 className="min-w-0 truncate text-sm leading-5">
                  <span className="font-medium text-stone-900">{branch.customer}</span>
                  <span className="font-normal text-stone-500">
                    {" "}
                    · {branchProductCount(branch)}{" "}
                    {branchProductCount(branch) === 1 ? "product" : "products"}
                  </span>
                </h2>
                <div className="flex h-[34px] shrink-0 items-center gap-2">
                  <span className="relative inline-flex">
                    <button
                      type="button"
                      className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
                      onClick={() => void createShipment()}
                    >
                      Create shipment
                    </button>
                    {creating ? <WorkingBeside side="left" /> : null}
                  </span>
                  <span className="mx-0.5 h-6 w-px shrink-0 bg-stone-300" aria-hidden />
                  <div className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
                    <button
                      type="button"
                      className="text-xs text-red-700 underline"
                      onClick={removeBranch}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
              {err ? (
                <DismissNote className="mt-3 text-xs text-red-700" onDismiss={() => setErr(null)}>
                  {err}
                </DismissNote>
              ) : null}
              <div className="flex shrink-0 flex-col gap-2 pt-3">
                <section className={GROUP}>
                  <dl className={`${GROUP_BODY} grid grid-cols-3 gap-x-3 gap-y-1.5`}>
                    <Fact label="Terms" value={branch.head.terms || "—"} />
                    <Fact label="Shipping method" value={branch.head.shipping_method || "—"} />
                    <Fact label="Sales rep" value={branch.head.sales_rep || "—"} />
                  </dl>
                </section>
                <div className="grid grid-cols-2 gap-2">
                  <Address title="Ship to" lines={branch.head.ship_to} />
                  <Address title="Bill to" lines={branch.head.bill_to} />
                </div>
              </div>
              <div className="mt-2 flex min-h-0 flex-1 flex-col">
                <BranchLines
                  key={branch.key}
                  branch={branch}
                  onSelect={setLineBack}
                  onRemoveOrder={(orderId) => update((current) => removeOrders(current, [orderId]))}
                  onRemoveProduct={(orderId, productId) =>
                    update((current) => removePick(current, orderId, productId))
                  }
                />
              </div>
            </>
          ) : (
            <p className="m-auto text-sm text-stone-500">
              {loading ? "Loading…" : list.length ? "Select a customer." : "The pick list is empty."}
            </p>
          )}
        </div>
      </div>
    </FitPage>
  );
}

function SelectionBridge({ onSelect }: { onSelect: (id: string | null) => void }) {
  const { selectedId } = useList();
  useEffect(() => {
    onSelect(selectedId);
  }, [onSelect, selectedId]);
  return null;
}

function BranchRow({ branch }: { branch: Branch }) {
  const bad = branchHasProblem(branch);
  return (
    <SelectableRow id={branch.key}>
      <td>{branch.customer}</td>
      <td>{branch.head.ship_to.slice(0, 1).join("") || "—"}</td>
      <td className="tabular-nums">{branch.orders.map((entry) => entry.order.order_no).join(", ")}</td>
      <td className={`tabular-nums ${bad ? "text-red-700" : ""}`}>{branchProductCount(branch)}</td>
    </SelectableRow>
  );
}

/** The selected customer's picked orders, each followed by its picked products. */
function BranchLines({
  branch,
  onSelect,
  onRemoveOrder,
  onRemoveProduct,
}: {
  branch: Branch;
  /** The selected order or product, for Back. */
  onSelect: (back: PickBack | null) => void;
  onRemoveOrder: (orderId: string) => void;
  onRemoveProduct: (orderId: string, productId: string) => void;
}) {
  const items: LineItem[] = branch.orders.flatMap((entry) => [
    { kind: "order" as const, id: `o:${entry.order.id}`, entry },
    ...entry.products.map((product) => ({
      kind: "product" as const,
      id: `p:${entry.order.id}:${product.line.product_id}`,
      order: entry.order,
      product,
    })),
  ]);
  const onLineSelect = useCallback(
    (id: string | null) => {
      const [kind, orderId, productId] = (id ?? "").split(":");
      if (!orderId) onSelect(null);
      else onSelect({ order_id: orderId, product_id: kind === "p" ? (productId ?? null) : null });
    },
    [onSelect],
  );

  return (
    <FitList
      items={items}
      getKey={(item) => item.id}
      stretch
      thead={
        <thead>
          <SelectionBridge onSelect={onLineSelect} />
          <tr className="text-stone-500">
            <th className="py-1">Order and product</th>
            <th className="w-24">Left to ship</th>
            <th></th>
            <th className="w-8"></th>
          </tr>
        </thead>
      }
      renderRow={(item) =>
        item.kind === "order" ? (
          <SelectableRow id={item.id}>
            <td className="font-medium">
              Order No {item.entry.order.order_no}
              {item.entry.order.po_no ? (
                <span className="font-normal text-stone-500"> · PO {item.entry.order.po_no}</span>
              ) : null}
            </td>
            <td className="font-medium tabular-nums">
              {item.entry.products
                .filter((product) => product.line.type === PRODUCT_TYPE.merchandise)
                .reduce((sum, product) => sum + product.line.left_to_ship, 0)}
            </td>
            <td className="text-xs text-red-700">{item.entry.problem ?? ""}</td>
            <td className="text-right">
              <RemoveButton
                label={`Take order ${item.entry.order.order_no} off the pick list`}
                onClick={() => onRemoveOrder(item.entry.order.id)}
              />
            </td>
          </SelectableRow>
        ) : (
          <SelectableRow id={item.id}>
            <td>
              <div className="pl-5">{item.product.line.label}</div>
            </td>
            <td className="tabular-nums">
              {item.product.line.type === PRODUCT_TYPE.merchandise
                ? item.product.line.left_to_ship
                : "—"}
            </td>
            <td className="text-xs text-red-700">{item.product.problem ?? ""}</td>
            <td className="text-right">
              <RemoveButton
                label={`Take ${item.product.line.label} off the pick list`}
                onClick={() => onRemoveProduct(item.order.id, item.product.line.product_id)}
              />
            </td>
          </SelectableRow>
        )
      }
    />
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="px-1 text-base leading-none text-stone-500 hover:text-stone-800"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      ×
    </button>
  );
}

const GROUP = "overflow-hidden rounded-md border border-stone-300 bg-stone-50";
const GROUP_BODY = "px-3 py-2";

/** Highlighted block header across the top of a group. */
function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">
      {children}
    </h3>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-stone-500">{label}</dt>
      <dd className="text-[13px] leading-tight break-words text-stone-900">{value}</dd>
    </div>
  );
}

function Address({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className={GROUP}>
      <GroupHeader>{title}</GroupHeader>
      <div className={GROUP_BODY}>
        {lines.length ? (
          lines.map((line, i) => (
            <p key={i} className="text-[13px] leading-tight text-stone-900">
              {line}
            </p>
          ))
        ) : (
          <p className="text-[13px] text-stone-400">—</p>
        )}
      </div>
    </section>
  );
}
