"use client";

import { useEffect, useId, useRef, useState } from "react";

export type ComboOption = { id: string; label: string };

const REJECT_MSG = "Pick a value from the list.";

function matchId(options: ComboOption[], text: string) {
  const t = text.trim();
  if (!t) return "";
  const exact = options.find((o) => o.label === t);
  if (exact) return exact.id;
  const lower = t.toLocaleLowerCase("en");
  const ci = options.find((o) => o.label.toLocaleLowerCase("en") === lower);
  return ci?.id ?? null;
}

function labelFor(options: ComboOption[], id: string) {
  return options.find((o) => o.id === id)?.label ?? "";
}

function validityMessage(
  options: ComboOption[],
  text: string,
  emptyOk: boolean,
  allowAny: boolean,
) {
  if (allowAny) return "";
  const matched = matchId(options, text);
  if (matched === "") return emptyOk ? "" : REJECT_MSG;
  if (matched == null) return REJECT_MSG;
  return "";
}

function shownText(options: ComboOption[], id: string, allowAny: boolean) {
  if (!id) return "";
  return labelFor(options, id) || (allowAny ? id : "");
}

/** True if an invalid Combo Box in `root` was found (and its native message shown). */
export function reportInvalidCombo(root: ParentNode | null) {
  const el = root?.querySelector<HTMLInputElement>("input[data-combo-invalid]");
  if (!el) return false;
  el.reportValidity();
  return true;
}

export function ComboBox({
  name,
  options,
  value,
  onChange,
  defaultValue = "",
  required = false,
  allowEmpty,
  placeholder,
  className = "rounded border px-2 py-1",
  allowAny = false,
  "aria-label": ariaLabel,
}: {
  name?: string;
  options: ComboOption[];
  value?: string;
  onChange?: (id: string) => void;
  defaultValue?: string;
  required?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  allowAny?: boolean;
  "aria-label"?: string;
}) {
  const emptyOk = allowEmpty ?? !required;
  const listId = useId().replace(/:/g, "");
  const controlled = value !== undefined;
  const [innerId, setInnerId] = useState(defaultValue);
  const id = controlled ? (value ?? "") : innerId;
  const [text, setText] = useState(() => shownText(options, id, allowAny));
  const lastSynced = useRef(id);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const idRef = useRef(id);
  idRef.current = id;
  const emptyOkRef = useRef(emptyOk);
  emptyOkRef.current = emptyOk;
  const allowAnyRef = useRef(allowAny);
  allowAnyRef.current = allowAny;

  const invalid = Boolean(validityMessage(options, text, emptyOk, allowAny));

  useEffect(() => {
    if (id === lastSynced.current) return;
    lastSynced.current = id;
    setText(shownText(options, id, allowAny));
  }, [id, options, allowAny]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid ? REJECT_MSG : "");
  }, [invalid]);

  useEffect(() => {
    const el = inputRef.current;
    const form = el?.form;
    if (!el || !form) return;
    function onSubmit(e: Event) {
      const msg = validityMessage(
        optionsRef.current,
        el.value,
        emptyOkRef.current,
        allowAnyRef.current,
      );
      if (!msg) return;
      e.preventDefault();
      el.setCustomValidity(msg);
      el.reportValidity();
    }
    function onReset() {
      lastSynced.current = "";
      if (!controlled) setInnerId("");
      onChange?.("");
      setText("");
      el.setCustomValidity("");
    }
    form.addEventListener("submit", onSubmit, true);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("submit", onSubmit, true);
      form.removeEventListener("reset", onReset);
    };
  }, [controlled, onChange]);

  function apply(nextId: string) {
    lastSynced.current = nextId;
    if (!controlled) setInnerId(nextId);
    onChange?.(nextId);
  }

  function revertShown(el: HTMLInputElement) {
    const label = shownText(optionsRef.current, idRef.current, allowAnyRef.current);
    el.value = label;
    setText(label);
    const msg = validityMessage(
      optionsRef.current,
      label,
      emptyOkRef.current,
      allowAnyRef.current,
    );
    el.setCustomValidity(msg);
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={id} /> : null}
      <input
        ref={inputRef}
        list={listId}
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        data-combo-invalid={invalid ? "" : undefined}
        autoComplete="off"
        className={className}
        required={required && !emptyOk}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const matched = matchId(options, v);
          if (matched === "" && emptyOk) apply("");
          else if (matched) apply(matched);
          else if (allowAny) apply(v);
          const msg = validityMessage(options, v, emptyOk, allowAny);
          e.target.setCustomValidity(msg);
        }}
        onBlur={(e) => {
          const msg = validityMessage(options, e.target.value, emptyOk, allowAny);
          if (msg) revertShown(e.target);
          else {
            const matched = matchId(options, e.target.value);
            if (matched) {
              apply(matched);
              const label = labelFor(options, matched);
              e.target.value = label;
              setText(label);
            } else if (allowAny) {
              apply(e.target.value);
            }
            e.target.setCustomValidity("");
          }
        }}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.label} />
        ))}
      </datalist>
    </>
  );
}
