"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FitPage } from "@/components/list/FitList";
import { FitList } from "@/components/list/FitList";
import { SelectableRow, RowButtons, useList } from "@/components/list/ListTable";
import { PageTitle, Btn } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { DismissNote } from "@/components/DismissNote";
import { SysFolder, SysFolderOpen } from "@/components/icons/SysImages";
import { SHIP_AT_ONCE } from "@/lib/customer-order";
import type { SeasonRow } from "@/lib/season";
import { deleteRequest, saveRequestHeader, submitRequest } from "./actions";
import { RequestProductsPanel } from "./RequestProductsPanel";
import type { RequestAddress, RequestLine, RequestOrder } from "./types";

function statusLabel(status: string) {
  if (status === "submitted") return "Sent";
  if (status === "accepted") return "Accepted";
  return "Draft";
}

function addressLabel(address: RequestAddress) {
  const place = [address.city, address.address_line1].filter(Boolean).join(", ");
  return [address.location_name, place].filter(Boolean).join(" • ") || "Address";
}

export function MyOrdersWorkspace({
  orders,
  lines,
  seasons,
  addresses,
  resumeId,
}: {
  orders: RequestOrder[];
  lines: RequestLine[];
  seasons: SeasonRow[];
  addresses: RequestAddress[];
  resumeId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(resumeId);
  const [panelId, setPanelId] = useState<string | null>(resumeId);
  const selected = orders.find((order) => order.id === selectedId) ?? null;

  return (
    <>
      <FitPage>
        <PageTitle title="My orders" />
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="flex w-1/2 min-w-0">
            <FitList
              items={orders}
              getKey={(order) => order.id}
              resumeId={resumeId}
              stretch
              thead={
                <thead>
                  <Bridge onSelect={setSelectedId} />
                  <tr className="text-stone-500">
                    <th className="py-1">Order</th>
                    <th className="py-1">Date</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
              }
              renderRow={(order) => (
                <SelectableRow id={order.id}>
                  <td className="py-1.5 font-medium">Order {order.request_no}</td>
                  <td className="tabular-nums">{order.created_at}</td>
                  <td>{statusLabel(order.status)}</td>
                </SelectableRow>
              )}
            />
          </div>
          <OrderDetails
            order={selected}
            seasons={seasons}
            addresses={addresses}
            panelOpen={panelId === selected?.id}
            onOpenProducts={() => selected && setPanelId(selected.id)}
            onSelect={setSelectedId}
          />
        </div>
      </FitPage>
      <RequestProductsPanel
        open={panelId != null && panelId === selectedId}
        onClose={() => setPanelId(null)}
        requestId={selected?.id ?? null}
        requestNo={selected?.request_no ?? null}
        lines={lines.filter((line) => line.request_id === selectedId)}
        draft={selected?.status === "draft"}
      />
    </>
  );
}

function OrderDetails({
  order,
  seasons,
  addresses,
  panelOpen,
  onOpenProducts,
  onSelect,
}: {
  order: RequestOrder | null;
  seasons: SeasonRow[];
  addresses: RequestAddress[];
  panelOpen: boolean;
  onOpenProducts: () => void;
  onSelect: (id: string | null) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const draft = order?.status === "draft";

  useEffect(() => {
    setEditing(false);
    setErr(null);
  }, [order?.id]);

  function send() {
    if (!order || sending) return;
    setSending(true);
    void (async () => {
      try {
        const message = await submitRequest(order.id);
        if (message) setErr(message);
        else router.refresh();
      } finally {
        setSending(false);
      }
    })();
  }

  return (
    <div className="flex w-1/2 min-w-0 flex-col rounded-lg border border-stone-300 bg-white p-3">
      {order ? (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2">
            <h2 className="min-w-0 truncate text-sm">
              <span className="font-medium">Order {order.request_no}</span>
              <span className="ml-2 font-light text-stone-500">{statusLabel(order.status)}</span>
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-7 cursor-pointer"
                aria-label="Products"
                title="Products"
                onClick={onOpenProducts}
              >
                {panelOpen ? <SysFolderOpen className="!h-full !w-auto" /> : <SysFolder className="!h-full !w-auto" />}
              </button>
              {draft ? (
                <span className="relative">
                  <Btn type="button" busy={sending} onClick={send}>
                    Send
                  </Btn>
                </span>
              ) : null}
              {draft ? (
                <RowButtons
                  editing={false}
                  dirty={false}
                  deleting={deleting}
                  onEdit={() => setEditing(true)}
                  onSave={() => {}}
                  onCancel={() => {}}
                  onDelete={() => {
                    if (!confirm(`Delete order ${order.request_no}?`)) return;
                    startDelete(async () => {
                      const message = await deleteRequest(order.id);
                      if (message) setErr(message);
                      else {
                        onSelect(null);
                        router.refresh();
                      }
                    });
                  }}
                />
              ) : null}
            </div>
          </div>
          {err ? (
            <DismissNote className="mt-3 text-xs text-red-700" onDismiss={() => setErr(null)}>
              {err}
            </DismissNote>
          ) : null}
          <div className="min-h-0 flex-1 space-y-2 overflow-auto pt-3">
            <Section>
              <Fact label="Season" value={order.future_season || "—"} />
              <Fact label="Start" value={order.start_date || "—"} />
              <Fact label="Cancel date" value={order.cancel_date || "—"} />
            </Section>
            <div className="grid grid-cols-2 gap-2">
              <Address title="Ship to" lines={order.ship} />
              <Address title="Bill to" lines={order.bill} />
            </div>
            <Section title="Notes">
              <p className="whitespace-pre-wrap text-[13px]">{order.notes || "—"}</p>
            </Section>
          </div>
          {editing ? (
            <EditCard
              order={order}
              seasons={seasons}
              addresses={addresses}
              onClose={() => setEditing(false)}
            />
          ) : null}
        </>
      ) : (
        <p className="m-auto text-sm text-stone-500">Select an order.</p>
      )}
    </div>
  );
}

function Bridge({ onSelect }: { onSelect: (id: string | null) => void }) {
  const { selectedId } = useList();
  useEffect(() => {
    onSelect(selectedId);
  }, [onSelect, selectedId]);
  return null;
}

function EditCard({
  order,
  seasons,
  addresses,
  onClose,
}: {
  order: RequestOrder;
  seasons: SeasonRow[];
  addresses: RequestAddress[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [season, setSeason] = useState(order.future_season ?? "");
  const [start, setStart] = useState(order.start_date ?? "");
  const [cancel, setCancel] = useState(order.cancel_date ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [shipId, setShipId] = useState("");
  const [billId, setBillId] = useState("");
  const [shipSet, setShipSet] = useState(false);
  const [billSet, setBillSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty =
    season !== (order.future_season ?? "") ||
    start !== (order.start_date ?? "") ||
    cancel !== (order.cancel_date ?? "") ||
    notes !== (order.notes ?? "") ||
    shipSet ||
    billSet;
  const shipChoices = addresses.filter(
    (address) => address.address_type === "shipping" || address.address_type === "both",
  );
  const billChoices = addresses.filter(
    (address) => address.address_type === "billing" || address.address_type === "both",
  );

  function save() {
    if (saving) return;
    const form = new FormData();
    form.set("future_season", season);
    form.set("start_date", start);
    form.set("cancel_date", cancel);
    form.set("notes", notes);
    if (shipSet) {
      form.set("ship_set", "1");
      form.set("ship_address_id", shipId);
    }
    if (billSet) {
      form.set("bill_set", "1");
      form.set("bill_address_id", billId);
    }
    setSaving(true);
    void (async () => {
      try {
        const message = await saveRequestHeader(order.id, form);
        if (message) {
          setErr(message);
          return;
        }
        onClose();
        router.refresh();
      } finally {
        setSaving(false);
      }
    })();
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-transparent p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => !saving && onClose()} />
      <div className="relative z-10 w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Order {order.request_no}</h2>
          <button type="button" className="text-lg leading-none text-stone-500" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {err ? (
          <DismissNote className="mb-2 text-xs text-red-700" onDismiss={() => setErr(null)}>
            {err}
          </DismissNote>
        ) : null}
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={season === SHIP_AT_ONCE}
            onChange={(event) => {
              if (event.target.checked) {
                setSeason(SHIP_AT_ONCE);
                if (!start) setStart(new Date().toISOString().slice(0, 10));
              } else {
                setSeason("");
              }
            }}
          />
          Ship at once
        </label>
        {season === SHIP_AT_ONCE ? null : (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Season</span>
            <ComboBox
              allowEmpty
              placeholder="Season"
              className="w-full rounded border py-1 pr-6 pl-2"
              value={season}
              onChange={setSeason}
              options={seasons.map((item) => ({ id: item.season, label: item.season }))}
            />
          </label>
        )}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Start</span>
            <input type="date" className="w-full rounded border px-2 py-1" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Cancel date</span>
            <input type="date" className="w-full rounded border px-2 py-1" value={cancel} onChange={(event) => setCancel(event.target.value)} />
          </label>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Ship to</span>
            <ComboBox
              allowEmpty
              placeholder="Ship to"
              className="w-full rounded border py-1 pr-6 pl-2"
              value={shipId}
              onChange={(id) => {
                setShipId(id);
                setShipSet(true);
              }}
              options={shipChoices.map((address) => ({ id: address.id, label: addressLabel(address) }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-stone-500">Bill to</span>
            <ComboBox
              allowEmpty
              placeholder="Bill to"
              className="w-full rounded border py-1 pr-6 pl-2"
              value={billId}
              onChange={(id) => {
                setBillId(id);
                setBillSet(true);
                if (addresses.find((address) => address.id === id)?.address_type === "both" && !shipSet) {
                  setShipId(id);
                  setShipSet(true);
                }
              }}
              options={billChoices.map((address) => ({ id: address.id, label: addressLabel(address) }))}
            />
          </label>
        </div>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs text-stone-500">Notes</span>
          <textarea className="w-full rounded border px-2 py-1" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {dirty ? (
          <div className="flex gap-2">
            <Btn type="button" busy={saving} onClick={save}>
              Save
            </Btn>
            <button type="button" className="rounded border border-stone-300 px-3 py-1.5 text-sm" onClick={onClose}>
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

const GROUP = "overflow-hidden rounded-md border border-stone-300 bg-stone-50";

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={GROUP}>
      {title ? (
        <h3 className="border-b border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">
          {title}
        </h3>
      ) : null}
      <div className={`grid grid-cols-3 gap-x-3 gap-y-1.5 px-3 py-2 ${title ? "" : ""}`}>{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-stone-500">{label}</dt>
      <dd className="text-[13px]">{value}</dd>
    </div>
  );
}

function Address({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className={GROUP}>
      <h3 className="border-b border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">
        {title}
      </h3>
      <div className="px-3 py-2 text-[13px]">
        {lines.length ? lines.map((line) => <p key={line}>{line}</p>) : <p>—</p>}
      </div>
    </section>
  );
}
