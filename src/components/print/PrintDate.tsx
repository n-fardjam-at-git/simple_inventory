"use client";

import { useEffect, useState } from "react";

/** Today's date on this computer, as MM/DD/YYYY. Filled right after mount, before the print dialog opens. */
export function PrintDate({ label = "Date" }: { label?: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setText(`${mm}/${dd}/${now.getFullYear()}`);
  }, []);

  return (
    <span className="tabular-nums">
      <span className="text-stone-500">{label}</span> {text}
    </span>
  );
}
