"use client";

import { useMemo, useState } from "react";
import { PageTitle } from "@/components/ui";
import { ComboBox } from "@/components/ComboBox";
import { FitPage } from "@/components/list/FitList";
import { DockedFilterPanel, filterToggleClass } from "@/components/filter/DockedFilterPanel";
import { FilterClear } from "@/components/filter/FilterClear";
import { CustomersTable, type CustomerRow, type SalesRepOption, type TermOption } from "./CustomersTable";
import type { CustomerAddress } from "./CustomerDetailsPanel";

type Filters = {
  account: string;
  name: string;
  businessName: string;
  sage: string;
  email: string;
  phone: string;
  cellPhone: string;
  termId: string;
  salesRepId: string;
  active: string;
  hold: string;
};

const EMPTY: Filters = {
  account: "",
  name: "",
  businessName: "",
  sage: "",
  email: "",
  phone: "",
  cellPhone: "",
  termId: "",
  salesRepId: "",
  active: "",
  hold: "",
};

const field = "w-full rounded border py-1 pr-6 pl-2";

function contains(hay: string | null | undefined, needle: string) {
  const q = needle.trim().toLocaleLowerCase("en");
  if (!q) return true;
  return (hay ?? "").toLocaleLowerCase("en").includes(q);
}

function applyFilters(rows: CustomerRow[], f: Filters) {
  return rows.filter((row) => {
    if (!contains(String(row.account_no), f.account)) return false;
    if (!contains(row.company_name, f.name)) return false;
    if (!contains(row.business_name, f.businessName)) return false;
    if (!contains(row.account_number, f.sage)) return false;
    if (!contains(row.email, f.email)) return false;
    if (!contains(row.phone, f.phone)) return false;
    if (!contains(row.cell_phone, f.cellPhone)) return false;
    if (f.termId && row.payment_term_id !== f.termId) return false;
    if (f.salesRepId && row.sales_rep_id !== f.salesRepId) return false;
    if (f.active === "1" && !row.is_active) return false;
    if (f.active === "0" && row.is_active) return false;
    if (f.hold === "yes" && !row.do_not_ship) return false;
    if (f.hold === "no" && row.do_not_ship) return false;
    return true;
  });
}

export function CustomersWorkspace({
  rows,
  terms,
  reps,
  addresses,
  canEdit,
}: {
  rows: CustomerRow[];
  terms: TermOption[];
  reps: SalesRepOption[];
  addresses: CustomerAddress[];
  canEdit: boolean;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [comboKey, setComboKey] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const filtered = useMemo(() => applyFilters(rows, applied), [rows, applied]);
  const isFiltered = Object.values(applied).some((value) => value.trim());
  const accountEntered = Boolean(draft.account.trim());
  const nameEntered = Boolean(draft.name.trim());
  const nameOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const row of rows) {
      const key = row.company_name.toLocaleLowerCase("en");
      if (!row.company_name || seen.has(key)) continue;
      seen.add(key);
      out.push({ id: row.company_name, label: row.company_name });
    }
    return out;
  }, [rows]);

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setComboKey((key) => key + 1);
  }

  function findByAccount() {
    const account = draft.account.trim();
    if (!account) return;
    const row = filtered.find((customer) => String(customer.account_no) === account);
    if (!row) return;
    setFocusId(row.id);
    setFocusNonce((n) => n + 1);
    setFilterOpen(false);
  }

  function findByName() {
    const name = draft.name.trim().toLocaleLowerCase("en");
    if (!name) return;
    const row = filtered.find((customer) => customer.company_name.toLocaleLowerCase("en") === name);
    if (!row) return;
    setFocusId(row.id);
    setFocusNonce((n) => n + 1);
    setFilterOpen(false);
  }

  function text(key: keyof Filters) {
    return {
      value: draft[key],
      onChange: (value: string) => setDraft((current) => ({ ...current, [key]: value })),
      onClear: () => setDraft((current) => ({ ...current, [key]: "" })),
    };
  }

  return (
    <>
      <PageTitle
        title="Customers"
        actions={
          rows.length ? (
            <button
              type="button"
              className={filterToggleClass(isFiltered)}
              onClick={() => setFilterOpen(true)}
            >
              {isFiltered ? "Filtered" : "Filter"}
            </button>
          ) : null
        }
      />
      <DockedFilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => setApplied(draft)}
        onReset={reset}
        comboKey={comboKey}
      >
        <label className="block">
          <span className="mb-1 block text-stone-500">Account</span>
          <FilterClear
            goVisible={accountEntered}
            onGo={findByAccount}
            onClear={text("account").onClear}
          >
            <input
              className={`w-full rounded border py-1 pl-2 ${accountEntered ? "pr-10" : "pr-6"}`}
              aria-label="Account"
              inputMode="numeric"
              value={draft.account}
              onChange={(e) => text("account").onChange(e.target.value)}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Name</span>
          <FilterClear goVisible={nameEntered} onGo={findByName} onClear={text("name").onClear}>
            <ComboBox
              allowEmpty
              allowAny
              aria-label="Name"
              className={`w-full rounded border py-1 pl-2 ${nameEntered ? "pr-10" : "pr-6"}`}
              value={draft.name}
              onChange={text("name").onChange}
              options={nameOptions}
            />
          </FilterClear>
        </label>
        <TextField label="Business name" {...text("businessName")} />
        <TextField label="Sage account" {...text("sage")} />
        <TextField label="Email" {...text("email")} />
        <TextField label="Phone" {...text("phone")} />
        <TextField label="Cell phone" {...text("cellPhone")} />
        <label className="block">
          <span className="mb-1 block text-stone-500">Sales rep</span>
          <FilterClear onClear={text("salesRepId").onClear}>
            <ComboBox
              allowEmpty
              aria-label="Sales rep"
              className={field}
              value={draft.salesRepId}
              onChange={text("salesRepId").onChange}
              options={reps.map((rep) => ({ id: rep.id, label: rep.name }))}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Terms</span>
          <FilterClear onClear={text("termId").onClear}>
            <ComboBox
              allowEmpty
              aria-label="Terms"
              className={field}
              value={draft.termId}
              onChange={text("termId").onChange}
              options={terms.map((term) => ({ id: term.id, label: term.term }))}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Status</span>
          <FilterClear onClear={text("active").onClear}>
            <ComboBox
              allowEmpty
              aria-label="Status"
              className={field}
              value={draft.active}
              onChange={text("active").onChange}
              options={[
                { id: "1", label: "Active" },
                { id: "0", label: "Inactive" },
              ]}
            />
          </FilterClear>
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-500">Do not ship</span>
          <FilterClear onClear={text("hold").onClear}>
            <ComboBox
              allowEmpty
              aria-label="Do not ship"
              className={field}
              value={draft.hold}
              onChange={text("hold").onChange}
              options={[
                { id: "yes", label: "Yes" },
                { id: "no", label: "No" },
              ]}
            />
          </FilterClear>
        </label>
      </DockedFilterPanel>
      <FitPage>
        <CustomersTable
          rows={filtered}
          terms={terms}
          reps={reps}
          addresses={addresses}
          canEdit={canEdit}
          focusId={focusId}
          focusNonce={focusNonce}
        />
      </FitPage>
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-stone-500">{label}</span>
      <FilterClear onClear={onClear}>
        <input
          className={field}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </FilterClear>
    </label>
  );
}
