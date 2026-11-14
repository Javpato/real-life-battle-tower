import { useMemo, useState } from "react";
import { today, localDate, total, type NutritionState } from "./engine";
import { dailyEnergySummary } from "./journalPreferences";
export default function Reports({ state }: { state: NutritionState }) {
  const [end, E] = useState(today()),
    [start, S] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return localDate(d);
    }),
    [selected, SELECT] = useState<string | null>(null);
  const data = useMemo(() => {
    const dates = new Set(
      state.entries
        .filter((e) => e.date >= start && e.date <= end && !e.planned)
        .map((e) => e.date),
    );
    return [...dates].sort().map((date) => {
      const rows = state.entries.filter((e) => e.date === date && !e.planned),
        sum = total(rows),
        goal = dailyEnergySummary(state, date);
      return {
        date,
        rows,
        sum,
        goal,
        complete: state.completeDays.includes(date),
      };
    });
  }, [state, start, end]);
  const rows = data.flatMap((d) => d.rows),
    sum = total(rows),
    maximum = Math.max(1, ...data.map((d) => d.sum.kcal ?? 0)),
    detail = data.find((d) => d.date === selected);
  const fmt = (v: number | null) =>
    v === null ? "Unknown" : Math.round(v).toLocaleString();
  function preset(days: number) {
    const d = new Date();
    d.setDate(d.getDate() - days + 1);
    S(localDate(d));
    E(today());
    SELECT(null);
  }
  return (
    <section className="card" data-guide="journal-reports">
      <div className="card-title">
        <h2>The bigger picture</h2>
        <span className="eyebrow">YOUR RECORDED HISTORY</span>
      </div>
      <p className="muted">
        Explore what you recorded. Unlogged days stay missing; planned meals are
        excluded.
      </p>
      <div className="button-row">
        <button className="secondary" onClick={() => preset(1)}>
          Today
        </button>
        <button className="secondary" onClick={() => preset(7)}>
          7 days
        </button>
        <button className="secondary" onClick={() => preset(30)}>
          30 days
        </button>
      </div>
      <div className="form-grid">
        <label>
          Report from
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => S(e.target.value)}
          />
        </label>
        <label>
          Report through
          <input
            type="date"
            min={start}
            value={end}
            onChange={(e) => E(e.target.value)}
          />
        </label>
      </div>
      {data.length ? (
        <>
          <div className="energy-summary">
            <div>
              <small>Recorded energy · selected days</small>
              <strong>{fmt(sum.kcal)} kcal</strong>
            </div>
            <div>
              <small>Days with food entries</small>
              <strong>
                {data.length} · {data.filter((d) => d.complete).length} marked
                complete
              </strong>
            </div>
            <div>
              <small>Logged proteins / carbs / fats</small>
              <strong>
                {fmt(sum.protein)} / {fmt(sum.carbs)} / {fmt(sum.fat)} g
              </strong>
            </div>
          </div>
          <div className="report-chart" aria-label="Recorded calories by day">
            {data.map((d) => (
              <button
                key={d.date}
                aria-label={`${d.date}: ${fmt(d.sum.kcal)} kcal, ${d.complete ? "complete" : "partial"} log`}
                onClick={() => SELECT(d.date)}
              >
                <span
                  style={{
                    height:
                      d.sum.kcal === null
                        ? 8
                        : Math.max(4, (d.sum.kcal / maximum) * 130),
                    background: d.complete ? "#5f885d" : "#c8d4b7",
                  }}
                />
                <small>{d.date.slice(5)}</small>
              </button>
            ))}
          </div>
          {detail && (
            <div className="notice">
              <strong>
                {detail.date} · {fmt(detail.sum.kcal)} kcal logged
              </strong>
              <p>
                {detail.rows.length} food entries ·{" "}
                {detail.complete ? "Marked complete" : "Partial log"}.{" "}
                {detail.goal.target !== null
                  ? `Historical food target: ${Math.round(detail.goal.target)} kcal using ${detail.goal.profile?.method}.`
                  : "No historical personalized target exists for this date."}
              </p>
              <p className="tiny">
                This reference uses the profile saved at that time, recorded
                additional activity and explicit dated overrides. Current weekly
                templates do not rewrite past days. Recorded energy is not
                measured energy expenditure.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="empty">
          No consumed-food entries in this date range. Start a journal when you
          feel ready.
        </div>
      )}
    </section>
  );
}
