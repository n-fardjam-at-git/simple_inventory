"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ListTable, useList } from "@/components/list/ListTable";

/** Viewport-tall column: list stretches, `shrink-0` siblings (Add form) stay on screen. */
export function FitPage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(320);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function measure() {
      const top = el.getBoundingClientRect().top;
      setH(Math.max(220, Math.floor(window.innerHeight - top - 12)));
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={ref} style={{ height: h }} className="flex min-h-0 flex-col gap-3">
      {children}
    </div>
  );
}

function startForResume<T>(items: T[], getKey: (item: T) => string, resumeId?: string | null) {
  if (!resumeId) return 0;
  const i = items.findIndex((item) => getKey(item) === resumeId);
  if (i <= 0) return 0;
  return i < 8 ? 0 : i;
}

export function FitList<T>({
  items,
  getKey,
  tableClassName = "",
  thead,
  renderRow,
  stretch = false,
  resumeId = null,
  focusId = null,
  focusNonce = 0,
}: {
  items: T[];
  getKey: (item: T) => string;
  tableClassName?: string;
  thead?: ReactNode;
  renderRow: (item: T) => ReactNode;
  stretch?: boolean;
  resumeId?: string | null;
  focusId?: string | null;
  focusNonce?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fillH, setFillH] = useState(320);
  const [start, setStart] = useState(() => startForResume(items, getKey, resumeId));
  const [count, setCount] = useState(8);
  const tooBig = useRef<number | null>(null);
  const history = useRef<number[]>([0]);
  const total = items.length;

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      if (stretch) {
        setFillH(Math.max(160, el.clientHeight));
        return;
      }
      const top = el.getBoundingClientRect().top;
      setFillH(Math.max(160, Math.floor(window.innerHeight - top - 12)));
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [stretch]);

  useLayoutEffect(() => {
    tooBig.current = null;
  }, [start, fillH]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const vp = root?.querySelector("[data-list-viewport]") as HTMLElement | null;
    const table = root?.querySelector("table.list-table") as HTMLElement | null;
    if (!vp || !table) return;
    const available = vp.clientHeight;
    if (available < 8) return;
    const remaining = total - start;
    if (remaining <= 0) return;
    const used = table.getBoundingClientRect().height;
    const fits = used <= available + 1;

    if (!fits && count > 1) {
      tooBig.current = count;
      setCount(count - 1);
      return;
    }
    if (fits && count < remaining && tooBig.current !== count + 1) {
      if (available - used > 40) setCount(count + 1);
    }
  }, [start, count, fillH, total]);

  useLayoutEffect(() => {
    if (!resumeId) return;
    const i = items.findIndex((item) => getKey(item) === resumeId);
    if (i < 0) return;
    if (i < start || i >= start + count) setStart(i);
  }, [resumeId, items, getKey, start, count]);

  const startRef = useRef(start);
  const countRef = useRef(count);
  startRef.current = start;
  countRef.current = count;

  const revealIndex = useCallback((index: number) => {
    const cur = startRef.current;
    const n = countRef.current;
    if (index >= cur && index < cur + n) return;
    history.current.push(index);
    setStart(index);
  }, []);

  const slice = items.slice(start, start + count);
  const hasPrev = start > 0;
  const hasNext = start + slice.length < total;
  const from = total === 0 ? 0 : start + 1;
  const to = start + slice.length;

  function goPrev() {
    history.current.pop();
    setStart(history.current[history.current.length - 1] ?? 0);
  }

  function goNext() {
    const next = start + slice.length;
    history.current.push(next);
    setStart(next);
  }

  return (
    <div
      ref={rootRef}
      style={stretch ? undefined : { height: fillH }}
      className={`min-h-0 overflow-hidden rounded-lg border border-stone-300 bg-white p-3 ${
        stretch ? "flex-1" : ""
      }`}
    >
      <ListTable
        className={tableClassName}
        fillViewport
        initialEditId={resumeId}
        footer={
          <>
            <FitListReveal
              items={items}
              getKey={getKey}
              focusId={focusId}
              focusNonce={focusNonce}
              onRevealIndex={revealIndex}
            />
            <FitListPager
              from={from}
              to={to}
              total={total}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onPrev={goPrev}
              onNext={goNext}
            />
          </>
        }
      >
        {thead}
        <tbody>
          {slice.map((item) => (
            <FitListRow key={getKey(item)} row={renderRow(item)} />
          ))}
        </tbody>
      </ListTable>
    </div>
  );
}

function FitListRow({ row }: { row: ReactNode }) {
  return <>{row}</>;
}

function FitListReveal<T>({
  items,
  getKey,
  focusId,
  focusNonce,
  onRevealIndex,
}: {
  items: T[];
  getKey: (item: T) => string;
  focusId: string | null;
  focusNonce: number;
  onRevealIndex: (index: number) => void;
}) {
  const { tryLeave, requestSelect } = useList();
  useEffect(() => {
    if (!focusNonce || !focusId) return;
    const i = items.findIndex((item) => getKey(item) === focusId);
    if (i < 0) return;
    tryLeave(() => {
      onRevealIndex(i);
      requestSelect(focusId);
    });
  }, [focusNonce, focusId]);
  return null;
}

function FitListPager({
  from,
  to,
  total,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  from: number;
  to: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { tryLeave } = useList();
  return (
    <div className="flex shrink-0 items-center justify-end gap-3 pt-2">
      <p className="mr-auto text-xs text-stone-500">
        {total === 0 ? "None" : `${from}–${to} of ${total}`}
      </p>
      <button
        type="button"
        disabled={!hasPrev}
        className="rounded border border-stone-300 bg-white px-3 py-1 text-sm disabled:opacity-40"
        onClick={() => tryLeave(onPrev)}
      >
        Previous
      </button>
      <button
        type="button"
        disabled={!hasNext}
        className="rounded border border-stone-300 bg-white px-3 py-1 text-sm disabled:opacity-40"
        onClick={() => tryLeave(onNext)}
      >
        Next
      </button>
    </div>
  );
}
