"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { DismissNote } from "@/components/DismissNote";
import { WorkingBeside } from "@/components/WorkingBeside";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, useList } from "@/components/list/ListTable";
import { SysFolder, SysFolderOpen } from "@/components/icons/SysImages";
import { summarizeOrder } from "@/lib/order-summary";
import { acceptOrderRequest, returnOrderRequest, saveStaffReply } from "./actions";
import type { DraftOrderLine, DraftOrderRow } from "./types";

const STATUS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  accepted: "Accepted",
};

export function DraftOrdersTable({
  rows,
  lines,
  canAct,
  focusId = null,
  focusNonce = 0,
  onOpen,
}: {
  rows: DraftOrderRow[];
  lines: DraftOrderLine[];
  canAct: boolean;
  focusId?: string | null;
  focusNonce?: number;
  onOpen: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex min-h-0 w-1/2 min-w-0 flex-col">
        <FitList
          items={rows}
          getKey={(row) => row.id}
          stretch
          focusId={focusId}
          focusNonce={focusNonce}
          thead={
            <thead>
              <SelectionBridge onSelect={onSelect} />
              <tr className="text-stone-500">
                <th className="py-1">PO No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Start</th>
                <th>Status</th>
              </tr>
            </thead>
          }
          renderRow={(row) => (
            <SelectableRow id={row.id}>
              <td className="py-1.5 tabular-nums">{row.request_no}</td>
              <td className="tabular-nums">{row.created_at}</td>
              <td>{row.customer}</td>
              <td className="tabular-nums">{row.start_date ?? "—"}</td>
              <td>{STATUS[row.status] ?? row.status}</td>
            </SelectableRow>
          )}
        />
      </div>
      <DraftDetails
        order={selected}
        lines={selected ? lines.filter((line) => line.request_id === selected.id) : []}
        canAct={canAct}
        onOpen={() => {
          if (selected) onOpen(selected.id);
        }}
      />
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

function DraftDetails({
  order,
  lines,
  canAct,
  onOpen,
}: {
  order: DraftOrderRow | null;
  lines: DraftOrderLine[];
  canAct: boolean;
  onOpen: () => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [ask, setAsk] = useState<null | "accept" | "return">(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submitted = order?.status === "submitted";

  useEffect(() => {
    setAsk(null);
    setErr(null);
  }, [order?.id]);

  function run() {
    if (!order || !ask || busy) return;
    const action = ask === "accept" ? acceptOrderRequest : returnOrderRequest;
    setErr(null);
    setBusy(true);
    start(async () => {
      try {
        const message = await action(order.id);
        if (message) setErr(message);
        else {
          setAsk(null);
          router.refresh();
        }
      } finally {
        setBusy(false);
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
              <span className="font-normal text-stone-500"> · PO No {order.request_no}</span>
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
              {canAct && submitted ? (
                <>
                  <button
                    type="button"
                    className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100 disabled:opacity-40"
                    disabled={busy}
                    onClick={() => setAsk("accept")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100 disabled:opacity-40"
                    disabled={busy}
                    onClick={() => setAsk("return")}
                  >
                    Return
                  </button>
                </>
              ) : null}
            </div>
          </div>
          {err && !ask ? (
            <DismissNote className="mt-3 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto pt-3 [&>*]:shrink-0">
            <Section cols={2}>
              <Fact label="Season" value={order.future_season || "—"} />
              <Fact label="Cancel date" value={order.cancel_date || "—"} />
            </Section>
            <Section title="Customer" cols={3}>
              <Fact label="Account" value={order.account_no == null ? "—" : String(order.account_no)} />
              <Fact label="Sage" value={order.account || "—"} />
              <Fact label="Sales rep" value={order.sales_rep || "—"} />
            </Section>
            <Section title="Terms and shipping" cols={3}>
              <Fact label="Terms" value={order.terms || "—"} />
              <Fact label="Received via" value={order.transmission_method || "—"} />
              <Fact label="Shipping method" value={order.shipping_method || "—"} />
            </Section>
            <div className="grid grid-cols-2 gap-2">
              <Address title="Ship to" lines={order.ship} />
              <Address title="Bill to" lines={order.bill} />
            </div>
            <StaffReply order={order} />
            <Section title="Notes" fill>
              <p className="whitespace-pre-wrap text-[13px] text-stone-900">{order.notes || "—"}</p>
            </Section>
          </div>
          <Summary lines={lines} onOpen={onOpen} />
        </>
      ) : (
        <p className="m-auto text-sm text-stone-500">Select an order.</p>
      )}
      {ask && order && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4">
              <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => !busy && setAsk(null)} />
              <Card className="relative w-full max-w-sm shadow-lg">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {ask === "accept"
                      ? `Accept order ${order.request_no}?`
                      : `Return order ${order.request_no}?`}
                  </p>
                  <button
                    type="button"
                    className="rounded border border-stone-300 px-2.5 py-1 text-lg leading-none text-stone-700 hover:bg-stone-100"
                    aria-label="Close"
                    onClick={() => !busy && setAsk(null)}
                  >
                    ×
                  </button>
                </div>
                <p className="mb-4 text-sm text-stone-600">
                  {ask === "accept"
                    ? "This copies the proposal into a pending customer order."
                    : "The customer can edit this proposal again."}
                </p>
                {err ? (
                  <DismissNote className="mb-3 text-xs text-red-700" onDismiss={() => setErr(null)}>
                    {err}
                  </DismissNote>
                ) : null}
                <div className="flex items-center gap-2">
                  <span className="relative">
                    {busy ? <WorkingBeside side="right" /> : null}
                    <button
                      type="button"
                      className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={run}
                    >
                      {ask === "accept" ? "Accept" : "Return"}
                    </button>
                  </span>
                  <button
                    type="button"
                    className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
                    disabled={busy}
                    onClick={() => setAsk(null)}
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
const FACT_COLS = { 2: "grid-cols-2", 3: "grid-cols-3" } as const;

function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">
      {children}
    </h3>
  );
}

function Section({
  title,
  cols,
  fill = false,
  children,
}: {
  title?: string;
  cols?: keyof typeof FACT_COLS;
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={fill ? `${GROUP} flex min-h-20 flex-1 flex-col !shrink` : GROUP}>
      {title ? <GroupHeader>{title}</GroupHeader> : null}
      <div className={fill ? `${GROUP_BODY} min-h-0 flex-1` : GROUP_BODY}>
        {cols ? <dl className={`grid ${FACT_COLS[cols]} gap-x-3 gap-y-1.5`}>{children}</dl> : children}
      </div>
    </section>
  );
}

function StaffReply({ order }: { order: DraftOrderRow }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [text, setText] = useState(order.staff_reply ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setText(order.staff_reply ?? "");
    setErr(null);
  }, [order.id, order.staff_reply]);

  const dirty = text !== (order.staff_reply ?? "");

  function save() {
    if (saving) return;
    setSaving(true);
    start(async () => {
      try {
        const message = await saveStaffReply(order.id, text);
        if (message) setErr(message);
        else router.refresh();
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <Section title="Staff reply">
      <textarea
        className="w-full rounded border bg-white px-2 py-1 text-[13px]"
        rows={3}
        value={text}
        aria-label="Staff reply"
        onChange={(event) => setText(event.target.value)}
      />
      {err ? (
        <DismissNote className="mt-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
          {err}
        </DismissNote>
      ) : null}
      {dirty ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="relative">
            {saving ? <WorkingBeside side="right" /> : null}
            <button
              type="button"
              className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={saving}
              onClick={save}
            >
              Save
            </button>
          </span>
          <button
            type="button"
            className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 hover:bg-stone-50"
            disabled={saving}
            onClick={() => setText(order.staff_reply ?? "")}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </Section>
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
          lines.map((line, index) => (
            <p key={index} className="text-[13px] leading-tight text-stone-900">
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

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function Summary({ lines, onOpen }: { lines: DraftOrderLine[]; onOpen: () => void }) {
  const totals = summarizeOrder(
    lines.map((line) => ({
      type: line.type,
      status: "pending",
      item: line.item,
      ordered: line.ordered,
      extended: line.extended,
      shipped: 0,
      shipped_value: 0,
    })),
  );
  const rule = "border-b border-stone-200";
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
              <tr key={item.item} className={rule}>
                <td className="w-10 py-0.5 text-right tabular-nums">{item.units}</td>
                <td className="py-0.5 pl-2">{item.item}</td>
                <td className="py-0.5 text-right tabular-nums">{usd.format(item.amount)}</td>
              </tr>
            ))}
            <tr className={`${rule} font-semibold`}>
              <td className="w-10 py-0.5 text-right tabular-nums">{totals.units}</td>
              <td className="py-0.5 pl-2">Total quantity</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.merchandise)}</td>
            </tr>
            <tr className={rule}>
              <td />
              <td className="py-0.5 pl-2">Surcharges</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.surcharge)}</td>
            </tr>
            <tr className={rule}>
              <td />
              <td className="py-0.5 pl-2">Freight</td>
              <td className="py-0.5 text-right tabular-nums">{usd.format(totals.freight)}</td>
            </tr>
            <tr>
              <td />
              <th className="py-1 pl-2 text-left text-sm font-semibold">Grand total</th>
              <td className="py-1 text-right text-sm font-semibold tabular-nums">{usd.format(totals.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
