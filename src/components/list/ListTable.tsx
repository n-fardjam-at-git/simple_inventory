"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { reportInvalidCombo } from "@/components/ComboBox";
import { WorkingBeside } from "@/components/WorkingBeside";

type RowApi = {
  dirty: boolean;
  revert: () => void;
  save: () => Promise<boolean>;
};

type LeavePrompt = {
  nextSelect: string | null;
  nextEdit: string | null;
  after?: () => void;
};

const ListCtx = createContext<{
  selectedId: string | null;
  editingId: string | null;
  register: (id: string, api: RefObject<RowApi>) => void;
  unregister: (id: string) => void;
  requestSelect: (id: string | null) => void;
  requestEdit: (id: string) => void;
  requestCancel: (id: string) => void;
  finishEdit: (id: string) => void;
  tryLeave: (after: () => void) => void;
} | null>(null);

export function useList() {
  const ctx = useContext(ListCtx);
  if (!ctx) throw new Error("useList must be inside ListTable");
  return ctx;
}

export function ListTable({
  children,
  className = "",
  footer,
  fillViewport = false,
  initialEditId = null,
}: {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  fillViewport?: boolean;
  initialEditId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialEditId);
  const [editingId, setEditingId] = useState<string | null>(initialEditId);
  const [leave, setLeave] = useState<LeavePrompt | null>(null);
  const apis = useRef(new Map<string, RefObject<RowApi>>());
  const rootRef = useRef<HTMLDivElement>(null);

  const register = useCallback((id: string, api: RefObject<RowApi>) => {
    apis.current.set(id, api);
  }, []);
  const unregister = useCallback((id: string) => {
    apis.current.delete(id);
  }, []);

  const applyLeave = useCallback((nextSelect: string | null, nextEdit: string | null) => {
    setEditingId(nextEdit);
    setSelectedId(nextSelect);
    setLeave(null);
  }, []);

  const requestSelect = useCallback(
    (id: string | null) => {
      if (!editingId || editingId === id) {
        setSelectedId(id);
        return;
      }
      const api = apis.current.get(editingId)?.current;
      if (!api?.dirty) {
        api?.revert();
        applyLeave(id, null);
        return;
      }
      setLeave({ nextSelect: id, nextEdit: null });
    },
    [editingId, applyLeave],
  );

  const requestEdit = useCallback(
    (id: string) => {
      if (editingId === id) return;
      if (!editingId) {
        setEditingId(id);
        setSelectedId(id);
        return;
      }
      const api = apis.current.get(editingId)?.current;
      if (!api?.dirty) {
        api?.revert();
        applyLeave(id, id);
        return;
      }
      setLeave({ nextSelect: id, nextEdit: id });
    },
    [editingId, applyLeave],
  );

  const requestCancel = useCallback(
    (id: string) => {
      apis.current.get(id)?.current?.revert();
      setEditingId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  const finishEdit = useCallback((id: string) => {
    setEditingId((cur) => (cur === id ? null : cur));
  }, []);

  const tryLeave = useCallback(
    (after: () => void) => {
      if (!editingId) {
        after();
        return;
      }
      const api = apis.current.get(editingId)?.current;
      if (!api?.dirty) {
        api?.revert();
        setEditingId(null);
        after();
        return;
      }
      setLeave({ nextSelect: null, nextEdit: null, after });
    },
    [editingId],
  );

  async function onPromptSave() {
    if (!leave || !editingId) return;
    if (reportInvalidCombo(rootRef.current)) return;
    const ok = await apis.current.get(editingId)?.current?.save();
    if (ok) {
      const after = leave.after;
      applyLeave(leave.nextSelect, leave.nextEdit);
      after?.();
    }
  }

  function onPromptDiscard() {
    if (!leave || !editingId) return;
    const after = leave.after;
    apis.current.get(editingId)?.current?.revert();
    applyLeave(leave.nextSelect, leave.nextEdit);
    after?.();
  }

  return (
    <ListCtx.Provider
      value={{
        selectedId,
        editingId,
        register,
        unregister,
        requestSelect,
        requestEdit,
        requestCancel,
        finishEdit,
        tryLeave,
      }}
    >
      <div ref={rootRef} className={fillViewport ? "h-full min-h-0" : undefined}>
      {fillViewport ? (
        <div className="flex h-full min-h-0 flex-col">
          <div data-list-viewport className="min-h-0 flex-1 overflow-hidden">
            <table className={`list-table w-full text-left text-sm ${className}`}>{children}</table>
          </div>
          {footer}
        </div>
      ) : (
        <>
          <table className={`list-table w-full text-left text-sm ${className}`}>{children}</table>
          {footer}
        </>
      )}
      </div>
      {leave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-sm rounded-lg bg-white p-4 shadow-lg">
            <p className="mb-4 text-sm">This row has unsaved changes.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-stone-300 px-3 py-1.5 text-sm"
                onClick={onPromptDiscard}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white"
                onClick={() => void onPromptSave()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ListCtx.Provider>
  );
}

export function useListRow(
  id: string,
  api: { dirty: boolean; revert: () => void; save: () => Promise<boolean> },
) {
  const ctx = useList();
  const apiRef = useRef(api);
  apiRef.current = api;
  useEffect(() => {
    ctx.register(id, apiRef);
    return () => ctx.unregister(id);
  }, [ctx, id]);
  return {
    selected: ctx.selectedId === id,
    editing: ctx.editingId === id,
    requestEdit: () => ctx.requestEdit(id),
    requestCancel: () => ctx.requestCancel(id),
    finishEdit: () => ctx.finishEdit(id),
  };
}

export function SelectableRow({
  id,
  dimmed,
  children,
}: {
  id: string;
  dimmed?: boolean;
  children: ReactNode;
}) {
  const { selectedId, editingId, requestSelect } = useList();
  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, textarea, label, details, summary")) return;
    if (selectedId === id) {
      if (editingId === id) return;
      requestSelect(null);
      return;
    }
    requestSelect(id);
  }
  return (
    <tr
      className={`${selectedId === id ? "is-selected" : ""} ${dimmed ? "text-stone-400" : ""}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function RowButtons({
  editing,
  dirty,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  saving = false,
  deleting = false,
}: {
  editing: boolean;
  dirty: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** While saving, Working… floats beside Save and another click is ignored. */
  saving?: boolean;
  /** While deleting, Working… floats beside Delete and another click is ignored. */
  deleting?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-md border border-stone-300 bg-stone-50 px-2 py-1">
      {(editing && dirty) || saving ? (
        <span className="relative">
          <button
            type="button"
            className="text-xs font-medium text-teal-800 underline"
            onClick={(e) => {
              if (saving) return;
              if (reportInvalidCombo((e.currentTarget as HTMLElement).closest("tr"))) return;
              onSave();
            }}
          >
            Save
          </button>
          {saving ? <WorkingBeside /> : null}
        </span>
      ) : null}
      {editing ? (
        <button type="button" className="text-xs text-stone-700 underline" onClick={onCancel}>
          Cancel
        </button>
      ) : (
        <button type="button" className="text-xs text-stone-700 underline" onClick={onEdit}>
          Edit
        </button>
      )}
      {onDelete ? (
        <span className="relative">
          <button
            type="button"
            className="text-xs text-red-700 underline"
            onClick={() => {
              if (deleting) return;
              onDelete();
            }}
          >
            Delete
          </button>
          {deleting ? <WorkingBeside /> : null}
        </span>
      ) : null}
    </div>
  );
}

