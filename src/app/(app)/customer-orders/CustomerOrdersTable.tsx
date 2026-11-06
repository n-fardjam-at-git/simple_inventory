"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DismissNote } from "@/components/DismissNote";
import { FitList } from "@/components/list/FitList";
import { RowButtons, SelectableRow, useList } from "@/components/list/ListTable";
import { WorkingBeside } from "@/components/WorkingBeside";
import { Btn, Card } from "@/components/ui";
import { SysApprove, SysApproved, SysFolder, SysFolderOpen, SysPrint, SysRevoke } from "@/components/icons/SysImages";
import { customerPickLabel } from "@/lib/customer";
import { orderStatusLabel } from "@/lib/customer-order";
import { summarizeOrder } from "@/lib/order-summary";
import { summaryLine, type OrderProductLine } from "./OrderProductsPanel";
import { approveCustomerOrder, deleteCustomerOrder, revokeCustomerOrder, saveCustomerOrderHeader } from "./actions";
import {
  OrderHeaderCard,
  type OrderAddress,
  type OrderCustomer,
  type OrderHeaderInitial,
  type OrderSeason,
  type OrderShipmentMethod,
  type OrderTerm,
  type OrderTransmissionMethod,
} from "./NewOrderForm";

export type CustomerOrderRow = {
  id: string;
  order_no: number;
  created_date: string | null;
  customer_id: string;
  customer: string;
  account_no: number | null;
  account: string;
  start_date: string | null;
  cancel_date: string | null;
  status: string;
  left_to_ship: number;
  future_season: string | null;
  terms: string | null;
  shipment_method_id: string | null;
  shipping_method: string | null;
  transmission_method_id: string | null;
  transmission_method: string | null;
  sales_rep: string | null;
  created_by: string | null;
  notes: string | null;
  ship_line1: string | null;
  ship_city: string | null;
  bill_line1: string | null;
  bill_city: string | null;
  ship_to: string[];
  bill_to: string[];
};

function matchAddress(
  addresses: OrderAddress[],
  customerId: string,
  kinds: string[],
  line1: string | null,
  city: string | null,
) {
  const line = (line1 ?? "").trim().toLowerCase();
  const town = (city ?? "").trim().toLowerCase();
  if (!line && !town) return "";
  return (
    addresses.find(
      (address) =>
        address.customer_id === customerId &&
        kinds.includes(address.address_type) &&
        (address.address_line1 ?? "").trim().toLowerCase() === line &&
        (address.city ?? "").trim().toLowerCase() === town,
    )?.id ?? ""
  );
}

function headerInitial(order: CustomerOrderRow, addresses: OrderAddress[]): OrderHeaderInitial {
  return {
    customerId: order.customer_id,
    customerLabel: customerPickLabel({
      account_no: order.account_no ?? 0,
      company_name: order.customer,
      account_number: order.account === "—" ? null : order.account,
    }),
    shipId: matchAddress(
      addresses,
      order.customer_id,
      ["shipping", "both"],
      order.ship_line1,
      order.ship_city,
    ),
    billId: matchAddress(
      addresses,
      order.customer_id,
      ["billing", "both"],
      order.bill_line1,
      order.bill_city,
    ),
    startDate: order.start_date ?? "",
    cancelDate: order.cancel_date ?? "",
    futureSeason: order.future_season ?? "",
    shipmentMethodId: order.shipment_method_id ?? "",
    shipmentLabel: order.shipping_method ?? "",
    transmissionMethodId: order.transmission_method_id ?? "",
    transmissionLabel: order.transmission_method ?? "",
    notes: order.notes ?? "",
    terms: order.terms ?? "",
  };
}

export function CustomerOrdersTable({
  rows,
  customers,
  addresses,
  shipmentMethods,
  transmissionMethods,
  seasons,
  terms,
  lines,
  onOpen,
  focusId = null,
  focusNonce = 0,
}: {
  lines: OrderProductLine[];
  rows: CustomerOrderRow[];
  customers: OrderCustomer[];
  addresses: OrderAddress[];
  shipmentMethods: OrderShipmentMethod[];
  transmissionMethods: OrderTransmissionMethod[];
  seasons: OrderSeason[];
  terms: OrderTerm[];
  onOpen: (id: string) => void;
  focusId?: string | null;
  focusNonce?: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    setEditing(false);
  }, []);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex min-h-0 w-1/2 min-w-0 flex-col">
        <FitList
          items={rows}
          getKey={(r) => r.id}
          stretch
          focusId={focusId}
          focusNonce={focusNonce}
          thead={
            <thead>
              <SelectionBridge onSelect={onSelect} />
              <tr className="text-stone-500">
                <th className="py-1">Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Start</th>
                <th>Status</th>
                <th>Left to ship</th>
              </tr>
            </thead>
          }
          renderRow={(r) => <OrderRow row={r} />}
        />
      </div>
      <OrderDetailsPanel
        order={selected}
        lines={selected ? lines.filter((line) => line.customer_order_id === selected.id) : []}
        deleting={deleting}
        deleteError={deleteErr}
        onDismissDeleteError={() => setDeleteErr(null)}
        onOpen={() => {
          if (selected) onOpen(selected.id);
        }}
        onEdit={() => {
          if (selected) setEditing(true);
        }}
        onDelete={() => {
          if (!selected || deleting) return;
          if (!confirm(`Delete order ${selected.order_no}?`)) return;
          const id = selected.id;
          setDeleteErr(null);
          setDeleting(true);
          start(async () => {
            try {
              const message = await deleteCustomerOrder(id);
              if (message) setDeleteErr(message);
            } finally {
              setDeleting(false);
            }
          });
        }}
      />
      {editing && selected ? (
        <OrderHeaderCard
          key={selected.id}
          title={`Order No ${selected.order_no}`}
          initial={headerInitial(selected, addresses)}
          shipSnapshot={selected.ship_to.length > 0}
          billSnapshot={selected.bill_to.length > 0}
          terms={terms}
          customers={customers}
          addresses={addresses}
          shipmentMethods={shipmentMethods}
          transmissionMethods={transmissionMethods}
          seasons={seasons}
          onClose={() => setEditing(false)}
          onSave={async (formData) => {
            const message = await saveCustomerOrderHeader(selected.id, formData);
            if (message) return message;
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function SelectionBridge({ onSelect }: { onSelect: (id: string | null) => void }) {
  const { selectedId } = useList();
  useEffect(() => {
    onSelect(selectedId);
  }, [onSelect, selectedId]);
  return null;
}


function OrderDetailsPanel({
  order,
  lines,
  deleting,
  deleteError,
  onDismissDeleteError,
  onOpen,
  onEdit,
  onDelete,
}: {
  order: CustomerOrderRow | null;
  lines: OrderProductLine[];
  deleting: boolean;
  deleteError: string | null;
  onDismissDeleteError: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [approveErr, setApproveErr] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeErr, setRevokeErr] = useState<string | null>(null);
  const [, startApprove] = useTransition();
  const [, startRevoke] = useTransition();
  const canApprove = order?.status === "pending";
  const approved = order?.status === "approved";

  useEffect(() => {
    setApproveErr(null);
    setRevokeErr(null);
    setConfirming(false);
  }, [order?.id]);

  function approve() {
    if (!order || approving) return;
    setApproveErr(null);
    setApproving(true);
    startApprove(async () => {
      try {
        const message = await approveCustomerOrder(order.id);
        if (message) setApproveErr(message);
        else {
          setConfirming(false);
          router.refresh();
        }
      } finally {
        setApproving(false);
      }
    });
  }

  function closeConfirm() {
    if (!approving) setConfirming(false);
  }

  function revoke() {
    if (!order || revoking) return;
    setRevokeErr(null);
    setRevoking(true);
    startRevoke(async () => {
      try {
        const message = await revokeCustomerOrder(order.id);
        if (message) setRevokeErr(message);
        else router.refresh();
      } finally {
        setRevoking(false);
      }
    });
  }

  return (
    <div className="flex min-h-0 w-1/2 min-w-0 flex-col overflow-hidden rounded-lg border border-stone-300 bg-white p-3">
      {order ? (
        <>
          <div className="flex h-[39px] shrink-0 items-end justify-between gap-3 border-b border-stone-300 pb-1">
            <h2 className="min-w-0 truncate text-sm leading-5">
              <span className="font-medium text-stone-900">{order.customer}</span>
              <span className="font-normal text-stone-500"> · Order No {order.order_no}</span>
            </h2>
            <div className="flex h-[34px] shrink-0 items-center gap-2">
              <button
                type="button"
                className="group inline-flex h-full cursor-pointer rounded text-stone-600 hover:text-stone-900 [&_svg]:h-[34px] [&_svg]:w-[34px]"
                aria-label="Open order"
                title="Open order"
                onClick={onOpen}
              >
                <SysFolder className="block group-hover:hidden" />
                <SysFolderOpen className="hidden group-hover:block" />
              </button>
              <Link
                href={`/customer-orders/${order.id}/print`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-full cursor-pointer rounded text-stone-600 hover:text-stone-900 [&_svg]:h-[34px] [&_svg]:w-[34px]"
                aria-label="Print order"
                title="Print order"
              >
                <SysPrint />
              </Link>
              {canApprove ? (
                <span className="relative inline-flex h-full">
                  <button
                    type="button"
                    className="inline-flex h-full cursor-pointer"
                    aria-label="Approve"
                    title="Approve"
                    onClick={() => {
                      if (!approving) setConfirming(true);
                    }}
                  >
                    <SysApprove className="!h-full !w-auto" />
                  </button>
                </span>
              ) : approved ? (
                <>
                  <span className="inline-flex h-full" aria-label="Approved" title="Approved">
                    <SysApproved className="!h-full !w-auto" />
                  </span>
                  <span className="relative inline-flex h-full">
                    <button
                      type="button"
                      className="inline-flex h-full cursor-pointer"
                      aria-label="Revoke approval"
                      title="Revoke approval"
                      onClick={revoke}
                    >
                      <SysRevoke className="!h-full !w-auto" />
                    </button>
                    {revoking ? <WorkingBeside side="left" /> : null}
                  </span>
                </>
              ) : null}
              <span className="mx-0.5 h-6 w-px shrink-0 bg-stone-300" aria-hidden />
              <div className="[&>div]:flex-nowrap">
                <RowButtons
                  editing={false}
                  dirty={false}
                  deleting={deleting}
                  onEdit={onEdit}
                  onSave={() => {}}
                  onCancel={() => {}}
                  onDelete={onDelete}
                />
              </div>
            </div>
          </div>
          {deleteError ? (
            <DismissNote className="mt-3 text-xs text-red-700" onDismiss={onDismissDeleteError}>
              {deleteError}
            </DismissNote>
          ) : null}
          {revokeErr ? (
            <DismissNote className="mt-3 text-xs text-red-700" onDismiss={() => setRevokeErr(null)}>
              {revokeErr}
            </DismissNote>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto pt-3 [&>*]:shrink-0">
            <Section cols={2}>
              <Fact label="Season" value={order.future_season || "—"} />
              <Fact label="Cancel date" value={order.cancel_date || "—"} />
            </Section>
            <Section title="Customer" cols={4}>
              <Fact label="Account" value={order.account_no == null ? "—" : String(order.account_no)} />
              <Fact label="Sage" value={order.account || "—"} />
              <Fact label="Sales rep" value={order.sales_rep || "—"} />
              <Fact label="Entered by" value={order.created_by || "—"} />
            </Section>
            <Section title="Terms and shipping" cols={3}>
              <Fact label="Terms" value={order.terms || "—"} />
              <Fact label="Received via" value={order.transmission_method || "—"} />
              <Fact label="Shipping method" value={order.shipping_method || "—"} />
            </Section>
            <div className="grid grid-cols-2 gap-2">
              <Address title="Ship to" lines={order.ship_to} />
              <Address title="Bill to" lines={order.bill_to} />
            </div>
            <Section title="Notes" fill>
              <p className="whitespace-pre-wrap text-[13px] text-stone-900">{order.notes || "—"}</p>
            </Section>
          </div>
          <OrderSummaryGroup lines={lines} onOpen={onOpen} />
        </>
      ) : (
        <p className="m-auto text-sm text-stone-500">Select an order.</p>
      )}
      {confirming && order && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4"
              onClick={closeConfirm}
            >
              <Card className="w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-medium">Approve order {order.order_no}?</p>
                  <button
                    type="button"
                    className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
                    aria-label="Close"
                    onClick={closeConfirm}
                  >
                    ×
                  </button>
                </div>
                {approveErr ? (
                  <DismissNote className="mb-3 text-xs text-red-700" onDismiss={() => setApproveErr(null)}>
                    {approveErr}
                  </DismissNote>
                ) : null}
                <div className="flex items-center gap-2">
                  <Btn type="button" busy={approving} onClick={approve}>
                    Approve
                  </Btn>
                  <button
                    type="button"
                    className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
                    onClick={closeConfirm}
                  >
                    Cancel
                  </button>
                </div>
              </Card>
            </div>,
            document.body,
          )
        : null}
    </div>
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
const FACT_COLS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
} as const;

/** One bordered group. With `cols` the children are Facts in a compact grid. */
function Section({
  title,
  cols,
  fill = false,
  children,
}: {
  title?: string;
  cols?: keyof typeof FACT_COLS;
  /** Grow to take the free height under the other groups. */
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={fill ? `${GROUP} flex min-h-20 flex-1 flex-col !shrink` : GROUP}>
      {title ? <GroupHeader>{title}</GroupHeader> : null}
      <div className={fill ? `${GROUP_BODY} min-h-0 flex-1` : GROUP_BODY}>
        {cols ? (
          <dl className={`grid ${FACT_COLS[cols]} gap-x-3 gap-y-1.5`}>{children}</dl>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/**
 * Order summary, pinned under the scrolling details. The same rows as the report:
 * one row per item, total quantity, surcharges, freight, grand total, shipped.
 */
function OrderSummaryGroup({ lines, onOpen }: { lines: OrderProductLine[]; onOpen: () => void }) {
  const totals = summarizeOrder(lines.map(summaryLine));
  const row = "border-b border-stone-200";
  return (
    <section
      className={`${GROUP} mt-2 shrink-0 cursor-pointer hover:border-stone-400`}
      title="Open the order products"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <GroupHeader>Order summary</GroupHeader>
      <div className={GROUP_BODY}>
        <table className="w-full text-[13px] leading-tight">
          <tbody>
            {totals.items.map((item) => (
              <tr key={item.item} className={row}>
                <td className="w-10 py-0.5 text-right tabular-nums">{item.units}</td>
                <td className="py-0.5 pl-2">{item.item}</td>
                <td className="py-0.5 text-right tabular-nums">{usd.format(item.amount)}</td>
              </tr>
            ))}
            <tr className={`${row} font-semibold`}>
              <td className="w-10 py-0.5 text-right tabular-nums">{totals.units}</td>
              <td className="py-0.5 pl-2">Total quantity</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.merchandise)}</td>
            </tr>
            <tr className={row}>
              <td />
              <td className="py-0.5 pl-2">Surcharges</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.surcharge)}</td>
            </tr>
            <tr className={row}>
              <td />
              <td className="py-0.5 pl-2">Freight</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.freight)}</td>
            </tr>
            <tr>
              <td />
              <th className="py-1 pl-2 text-left text-sm font-semibold">Grand total</th>
              <td className="py-1 text-right text-sm font-semibold tabular-nums">
                {usd.format(totals.total)}
              </td>
            </tr>
            <tr className="border-t border-stone-300 text-stone-600">
              <td className="w-10 pt-1 pb-0.5 text-right tabular-nums">{totals.shipped_qty}</td>
              <td className="pt-1 pb-0.5 pl-2">Shipped</td>
              <td className="pt-1 pb-0.5 text-right tabular-nums">
                {usd.format(totals.shipped_value)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
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

function OrderRow({ row }: { row: CustomerOrderRow }) {
  return (
    <SelectableRow id={row.id}>
      <td className="py-1.5 tabular-nums">
        <Link href={`/customer-orders/${row.id}`} className="underline">
          {row.order_no}
        </Link>
      </td>
      <td className="tabular-nums">{row.created_date ?? "—"}</td>
      <td>{row.customer}</td>
      <td className="tabular-nums">{row.start_date ?? "—"}</td>
      <td className={row.status === "approved" ? "text-red-700" : undefined}>
        {orderStatusLabel(row.status)}
      </td>
      <td className="tabular-nums">{row.left_to_ship}</td>
    </SelectableRow>
  );
}
