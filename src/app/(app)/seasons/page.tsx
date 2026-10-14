import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageTitle, Btn } from "@/components/ui";
import { SEASON_PERIODS, asSeasonRows } from "@/lib/season";
import { addSeason } from "./actions";
import { SeasonsTable } from "./SeasonsTable";
import { NumericInput } from "@/components/NumericInput";
import { FitPage } from "@/components/list/FitList";
import { AddForm } from "@/components/AddForm";

export default async function SeasonsPage() {
  await requireRoles(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, year, start_season, is_combo, season");
  const rows = asSeasonRows(data ?? []);

  return (
    <div>
      <PageTitle title="Seasons" />
      <FitPage>
      {rows.length === 0 ? (
        <p className="min-h-0 flex-1 text-sm text-stone-500">No seasons yet.</p>
      ) : (
        <SeasonsTable rows={rows} />
      )}
      <AddForm action={addSeason} className="flex shrink-0 flex-wrap items-end gap-2 text-sm">
        <label>
          Period
          <select name="period" className="ml-2 rounded border px-2 py-1">
            {SEASON_PERIODS.map((p) => (
              <option key={`${p.start}:${p.combo ? 1 : 0}`} value={`${p.start}:${p.combo ? 1 : 0}`}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <NumericInput
            name="year"
            required
            inputMode="numeric"
            defaultValue={String(new Date().getFullYear())}
            className="ml-2 w-20 rounded border px-2 py-1"
          />
        </label>
        <Btn type="submit">Add</Btn>
      </AddForm>
      </FitPage>
    </div>
  );
}
