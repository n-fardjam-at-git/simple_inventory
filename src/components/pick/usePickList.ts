"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isPickListKey,
  parsePickBack,
  parsePickList,
  pickBackKey,
  pickListKey,
  type PickBack,
  type PickList,
} from "@/lib/pick-list";

const CHANGED = "pick-list-change";

/**
 * This staff login's pick list, kept in the browser. Every component that uses it
 * (the Pick buttons, the menu count, the Pick list page) follows the same list,
 * in this tab and in the others.
 */
export function usePickList(userId: string) {
  const [list, setList] = useState<PickList>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = pickListKey(userId);
    const load = () => setList(parsePickList(window.localStorage.getItem(key)));
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) load();
    };
    load();
    setReady(true);
    window.addEventListener(CHANGED, load);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGED, load);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId]);

  const update = useCallback(
    (change: (list: PickList) => PickList) => {
      const key = pickListKey(userId);
      const next = change(parsePickList(window.localStorage.getItem(key)));
      if (next.length) window.localStorage.setItem(key, JSON.stringify(next));
      else window.localStorage.removeItem(key);
      window.dispatchEvent(new Event(CHANGED));
    },
    [userId],
  );

  return { list, ready, update };
}

/** Remembers the order product Back returns to. */
export function writePickBack(userId: string, back: PickBack) {
  window.localStorage.setItem(pickBackKey(userId), JSON.stringify(back));
}

export function readPickBack(userId: string) {
  return parsePickBack(window.localStorage.getItem(pickBackKey(userId)));
}

/** Sign out empties the pick list of every login kept in this browser. */
export function clearPickStorage() {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && isPickListKey(key)) keys.push(key);
  }
  for (const key of keys) window.localStorage.removeItem(key);
}
