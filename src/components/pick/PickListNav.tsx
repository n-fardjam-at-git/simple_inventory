"use client";

import { countPicks } from "@/lib/pick-list";
import { clearPickStorage, usePickList } from "./usePickList";

/** The count beside Pick list in the menu: picked order products. */
export function PickListCount({ userId }: { userId: string }) {
  const { list, ready } = usePickList(userId);
  const count = countPicks(list);
  if (!ready || count === 0) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-stone-900 px-1.5 text-xs font-medium text-white tabular-nums">
      {count}
    </span>
  );
}

/** Sign out. The pick list lasts until then. */
export function SignOutButton() {
  return (
    <button
      className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-100"
      type="submit"
      onClick={() => clearPickStorage()}
    >
      Sign out
    </button>
  );
}
