"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Reload server props and resolve only after this row is a new object from that reload.
 * Edit mode can stay up until then, so view mode does not flash the previous quantities.
 */
export function useRefreshRow(row: object) {
  const router = useRouter();
  const seen = useRef(row);
  const done = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!done.current) {
      seen.current = row;
      return;
    }
    if (Object.is(seen.current, row)) return;
    const finish = done.current;
    done.current = null;
    seen.current = row;
    finish();
  }, [row]);

  return function refreshRow() {
    return new Promise<void>((resolve) => {
      seen.current = row;
      done.current = resolve;
      router.refresh();
    });
  };
}
