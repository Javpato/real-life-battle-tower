import { useState, useEffect, useRef, type ReactNode } from "react";
import JournalSettings, {
  JournalReminderBanner,
  useJournalPreferences,
} from "./JournalSettings";
import FoodSearch from "./FoodSearch";
import BarcodeScanner from "./BarcodeScanner";
import {readBarcodePhoto} from "./barcodeScanner";
import {
  dailyEnergySummary,
  displayWeight,
  lbToKg,
  kgToLb,
  cmToIn,
  inToCm,
  gramsToOunces,
  ouncesToGrams,
} from "./journalPreferences";
import ProjectionPanel from "./ProjectionPanel";
import Reports from "./Reports";
import {
  Plus,
  ScanLine,
  ArrowLeft,
  Flame,
  Footprints,
  TrendingUp,
  Settings2,
  Utensils,
  Heart,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
  Star,
  BookOpen,
  X,
} from "lucide-react";
import {
  type NutritionState,
  type Food,
  type Entry,
  type Profile,
  energy,
  total,
  scale,
  today,
  lookupBarcode,
  rollingAverage,
  csv,
  recipe,
} from "./engine";
import "./journal-rpg.css";
export default function Journal({
  state: s,
  onChange: set,
  onClose,
  onDiscover,
  storageScope = "local",
  onDeleteJournal,
  onGuideEvent,
  syncPanel,
}: {
  state: NutritionState;
  onChange: (n: NutritionState) => void;
  onClose: () => void;
  onDiscover: (code: string) => void;
  storageScope?: "local" | "cloud";
  onDeleteJournal?: () => void | Promise<void>;
  onGuideEvent?: (event:string) => void;
  syncPanel?: ReactNode;
}) {
  const prefs = useJournalPreferences();
  const lookupRequest=useRef<AbortController|null>(null),photoGeneration=useRef(0),guideCallback=useRef(onGuideEvent);
  guideCallback.current=onGuideEvent;
  useEffect(()=>{guideCallback.current?.('journal:opened');return()=>{photoGeneration.current++;lookupRequest.current?.abort();};},[]);
  const [tab, T] = useState("Today"),
    [date, D] = useState(today()),
    [add, A] = useState(false),
    [food, F] = useState<Food | null>(null),
    [amount, G] = useState(100),
    [meal, M] = useState("Breakfast"),
    [status, S] = useState(""),
    [showCalc, C] = useState(false),
    [profile, P] = useState(s.profile),
    [newFood, N] = useState({
      name: "",
      kcal: "",
      protein: "",
      carbs: "",
      fat: "",
      fiber: "",
    }),
    [recipeName, R] = useState(""),
    [yieldG, Y] = useState(400),
    [recipeIds, RI] = useState<string[]>([]),
    [scanning, setScanning] = useState(false),
    [lookingUp, setLookingUp] = useState(false),
    [readingPhoto, setReadingPhoto] = useState(false);
  useEffect(()=>{guideCallback.current?.(`journal:tab:${tab}`);},[tab]);
  const cancelLookup=()=>{photoGeneration.current++;lookupRequest.current?.abort();lookupRequest.current=null;setLookingUp(false);setReadingPhoto(false);};
  const closeJournal=()=>{cancelLookup();setScanning(false);onClose();};
  const selectFood=(value:Food)=>{cancelLookup();setScanning(false);F(value);S("Check the label, then confirm your portion.");};
  const entries = s.entries.filter((e) => e.date === date && !e.planned),
    totals = total(entries),
    summary = dailyEnergySummary(s, date),
    activeProfile = summary.profile,
    calc = summary.calc,
    acts = summary.activities,
    target = summary.target;
  const kcal = totals.kcal ?? 0;
  useEffect(() => P(s.profile), [s.profile]);
  const update = (patch: Partial<NutritionState>) => set({ ...s, ...patch });
  const changeDate = (n: number) => {
    const dt = new Date(date + "T12:00:00");
    dt.setDate(dt.getDate() + n);
    D(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`,
    );
  };
  function saveFood() {
    if (!food || !Number.isFinite(amount) || amount <= 0) {
      S("Enter a positive amount.");
      return;
    }
    update({
      entries: [
        ...s.entries,
        {
          id: crypto.randomUUID(),
          food: structuredClone(food),
          amount,
          date,
          meal,
          planned: date > today(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    A(false);
    F(null);
    S("");
    cancelLookup();
    setScanning(false);
  }
  async function lookup(code: string) {
    cancelLookup();setScanning(false);F(null);
    const controller=new AbortController();lookupRequest.current=controller;setLookingUp(true);
    S(`Barcode read: ${code}. Looking up the product…`);
    try {
      const f=await lookupBarcode(code,controller.signal);
      if(lookupRequest.current!==controller)return;
      F(f);S("Product found. Check the label, then confirm your portion.");
    } catch(e) {
      if(lookupRequest.current!==controller)return;
      S((e as Error).name==='AbortError'?'Product lookup took too long. Retry, search the name or enter the label.':(e as Error).message==='Failed to fetch'?'Barcode read, but the product service could not be reached. Check your connection and retry.':(e as Error).message);
    } finally {if(lookupRequest.current===controller){lookupRequest.current=null;setLookingUp(false);}}
  }
  function scan(){cancelLookup();F(null);S("");setScanning(true);}
  async function scanPhoto(file:File){
    cancelLookup();setScanning(false);F(null);const generation=++photoGeneration.current;
    setReadingPhoto(true);S('Reading the barcode photo on this device…');
    try{const code=await readBarcodePhoto(file);if(generation===photoGeneration.current)await lookup(code);}
    catch(e){if(generation===photoGeneration.current)S((e as Error).message);}
    finally{if(generation===photoGeneration.current)setReadingPhoto(false);}
  }
  function manual() {
    cancelLookup();setScanning(false);
    if (
      !newFood.name.trim() ||
      newFood.kcal === "" ||
      !Number.isFinite(Number(newFood.kcal)) ||
      Number(newFood.kcal) < 0
    ) {
      S("Add a name and non-negative energy from the label.");
      return;
    }
    const val = (k: keyof typeof newFood) =>
      newFood[k] === "" ? null : Math.max(0, Number(newFood[k]));
    F({
      id: crypto.randomUUID(),
      name: newFood.name,
      source: "Your label · entered manually",
      per100: {
        kcal: val("kcal"),
        protein: val("protein"),
        carbs: val("carbs"),
        fat: val("fat"),
        fiber: val("fiber"),
      },
    });
  }
  function download(name: string, data: string, type: string) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function saveProfile() {
    P(profile);
    update({
      profile,
      goalHistory: [
        ...s.goalHistory,
        { date: new Date().toISOString(), profile: structuredClone(profile) },
      ],
    });
    S("Your calculation preferences are saved.");
  }
  const field = (label: string, key: keyof Profile, unit: string, min = 0) => {
    const imperial = prefs.units === "imperial",
      v =
        typeof profile[key] === "number" ? (profile[key] as number) : undefined;
    const shown =
      v === undefined
        ? ""
        : imperial && key === "weight"
          ? Number(kgToLb(v).toFixed(2))
          : imperial && key === "height"
            ? Number(cmToIn(v).toFixed(2))
            : v;
    return (
      <label>
        {label}
        <span className="input-unit">
          <input
            aria-label={label}
            type="number"
            min={min}
            step="any"
            value={shown}
            onChange={(e) => {
              const raw =
                e.target.value === "" ? undefined : Number(e.target.value);
              P({
                ...profile,
                [key]:
                  raw === undefined
                    ? undefined
                    : imperial && key === "weight"
                      ? lbToKg(raw)
                      : imperial && key === "height"
                        ? inToCm(raw)
                        : raw,
              });
            }}
          />
          <small>
            {imperial && key === "weight"
              ? "lb"
              : imperial && key === "height"
                ? "in"
                : unit}
          </small>
        </span>
      </label>
    );
  };
  return (
    <div className="journal journal-rpg" data-guide="journal" aria-label="Field journal">
      <aside className="journal-nav" data-guide="journal-tabs" aria-label="Journal chapters">
        <button className="brand" onClick={closeJournal}>
          <span className="brand-mark"><BookOpen size={27}/></span>
          <span>
            Field journal<small>COZYLIGHT · PERSONAL NOTES</small>
          </span>
        </button>
        <div className="nav-caption">CHAPTERS OF YOUR DAY</div>
        {[
          ["Today", Flame],
          ["Food", Utensils],
          ["Activity", Footprints],
          ["Progress", TrendingUp],
          ["Profile", Settings2],
        ].map(([name, Icon]) => {
          const I = Icon as typeof Flame;
          return (
            <button
              data-guide={`journal-tab-${String(name).toLowerCase()}`}
              aria-current={tab===name?"page":undefined}
              className={tab === name ? "selected" : ""}
              key={name as string}
              onClick={() => {
                T(name as string);
                S("");
              }}
            >
              <I size={19} aria-hidden="true" />
              {name as string}
            </button>
          );
        })}
        <div className="nav-bottom">
          <div className="journal-note">
            <span>✧</span>
            <strong>
              A little more aware.
              <br />A little more you.
            </strong>
            <p>Your journal supports your life. It doesn’t score it.</p>
          </div>
          <button onClick={closeJournal}>
            <ArrowLeft size={17} />
            Return to Battle Tower
          </button>
        </div>
      </aside>
      <main className="journal-main" data-journal-chapter={tab}>
        <header className="journal-top">
          <span>
            <BookOpen size={18} aria-hidden="true"/> FIELD JOURNAL{" "}
            <small>
              {storageScope === "cloud"
                ? "Shared across linked devices"
                : "Saved on this device"}
            </small>
          </span>
          <button
            className="icon-button"
            onClick={() => T("Profile")}
            data-guide="journal-settings"
            aria-label="Profile"
          >
            <Settings2 size={20} />
          </button>
          <button className="journal-exit" data-guide="journal-close" onClick={closeJournal} aria-label="Return to Battle Tower"><span>Return to Battle Tower</span><X size={20}/></button>
        </header>
        <div className="journal-heading">
          <div>
            <div className="eyebrow">YOUR TRAINING, BETWEEN THE PAGES</div>
            <h1>
              {tab === "Today"
                ? "A good day starts here."
                : tab === "Food"
                  ? "A little of what you love."
                  : tab === "Activity"
                    ? "Every move matters."
                    : tab === "Progress"
                      ? "Look how far you’ve come."
                      : "Your journey, your way."}
            </h1>
            <p>
              {tab === "Today"
                ? "Nourish your body. Find your rhythm. Keep exploring."
                : tab === "Food"
                  ? "Your meals, your portions, a clearer picture."
                  : tab === "Activity"
                    ? "Movement is more than a number. Count it only once."
                    : tab === "Progress"
                      ? "Small fluctuations are normal. Give your story time."
                      : "Only share what feels right. You can always change it."}
            </p>
          </div>
          <button
            className="primary"
            data-guide="journal-add"
            onClick={() => {
              A(true);
              F(null);
              S("");
            }}
          >
            <Plus size={18} />
            Add food
          </button>
        </div>
        <div className="date-row" data-guide="journal-date">
          <button onClick={() => changeDate(-1)} aria-label="Previous day">
            <ChevronLeft size={18} />
          </button>
          <input
            aria-label="Journal date"
            type="date"
            value={date}
            onChange={(e) => D(e.target.value)}
          />
          <button onClick={() => changeDate(1)} aria-label="Next day">
            <ChevronRight size={18} />
          </button>
          <span>
            {date === today()
              ? "TODAY"
              : date > today()
                ? "PLANNING"
                : "YOUR JOURNAL"}
          </span>
        </div>
        {syncPanel && <div className="journal-sync-panel" data-guide="journal-sync">{syncPanel}</div>}
        <JournalReminderBanner state={s} />
        {status && (
          <div className="notice" role="status">
            {status}
          </div>
        )}
        {tab === "Today" && (
          <>
            <div className="dashboard-grid">
              <section className="card energy-card">
                <div className="card-title">
                  <h2>Daily nourishment</h2>
                  <button
                    className="icon-button"
                    aria-label="Explain calculation"
                    onClick={() => C(!showCalc)}
                  >
                    <Info size={17} />
                  </button>
                </div>
                <div className="energy-body">
                  <div
                    className="calorie-ring"
                    style={{
                      background: `conic-gradient(#427b56 ${target ? Math.min(100, (kcal / target) * 100) : 0}%, #edf0e8 0)`,
                    }}
                  >
                    <div>
                      <Flame size={23} />
                      <strong>
                        {entries.length
                          ? totals.kcal === null
                            ? "Unknown"
                            : Math.round(kcal).toLocaleString()
                          : "—"}
                      </strong>
                      <span>kcal logged</span>
                    </div>
                  </div>
                  <div className="energy-details">
                    <div>
                      <span>Daily food target</span>
                      <strong>
                        {target
                          ? Math.round(target).toLocaleString()
                          : "Not set"}{" "}
                        <small>{target ? "kcal" : ""}</small>
                      </strong>
                    </div>
                    <div>
                      <span>
                        {target && kcal > target
                          ? "Above food target"
                          : "Remaining to target"}
                      </span>
                      <strong>
                        {target && totals.kcal !== null
                          ? Math.round(Math.abs(target - kcal)).toLocaleString()
                          : "—"}{" "}
                        <small>{target ? "kcal" : ""}</small>
                      </strong>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => T("Profile")}
                    >
                      {target
                        ? "Review your calculation"
                        : "Set up your optional profile"}{" "}
                      →
                    </button>
                  </div>
                </div>
                <div className="card-foot">
                  <span className="small-dot" />{" "}
                  {s.completeDays.includes(date)
                    ? "Day marked complete"
                    : "A partial log is a partial picture."}
                  <button
                    className="text-button"
                    onClick={() =>
                      update({
                        completeDays: s.completeDays.includes(date)
                          ? s.completeDays.filter((d) => d !== date)
                          : [...s.completeDays, date],
                      })
                    }
                  >
                    {s.completeDays.includes(date)
                      ? "Reopen day"
                      : "Mark complete"}
                  </button>
                </div>
              </section>
              <section className="card macros">
                <h2>The building blocks</h2>
                <p className="muted">Your recorded macronutrients</p>
                {[
                  [
                    "Protein",
                    "protein",
                    "#b2794f",
                    activeProfile?.proteinTarget ??
                      (activeProfile?.weight
                        ? Math.round(activeProfile.weight * 1.2)
                        : null),
                  ],
                  [
                    "Carbs",
                    "carbs",
                    "#d2b458",
                    target ? Math.round((target * 0.5) / 4) : null,
                  ],
                  [
                    "Fats",
                    "fat",
                    "#799a79",
                    target ? Math.round((target * 0.3) / 9) : null,
                  ],
                ].map(([label, key, color, goal]) => (
                  <div className="macro" key={key as string}>
                    <div>
                      <span>
                        <i style={{ background: color as string }} />
                        {label}
                      </span>
                      <strong>
                        {totals[key as "protein"] === null
                          ? "Unknown"
                          : Math.round(totals[key as "protein"] ?? 0)}{" "}
                        <small>{goal ? `/ ${goal} g` : "g"}</small>
                      </strong>
                    </div>
                    <div className="track">
                      <span
                        style={{
                          background: color as string,
                          width: `${goal ? Math.min(100, ((totals[key as "protein"] ?? 0) / Number(goal)) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <p className="tiny">
                  Reference targets are editable estimates, not prescriptions.
                </p>
              </section>
              <section className="card adventure-card">
                <div className="eyebrow">LIFE BEYOND THE NUMBERS</div>
                <h2>
                  Your next ascent
                  <br />
                  is a step away.
                </h2>
                <p>
                  Take a moment to recover.
                  <br />Your next tower floor will be waiting.
                </p>
                <button onClick={closeJournal}>
                  Back to Battle Tower{" "}
                  <ArrowLeft
                    size={16}
                    style={{ transform: "rotate(180deg)" }}
                  />
                </button>
                <div className="little-hills">
                  <span>♧</span>
                  <span>♧</span>
                  <span>✦</span>
                </div>
              </section>
            </div>
            {showCalc && (
              <section className="card notice">
                <h3>Where these numbers come from</h3>
                <p>
                  Resting estimate:{" "}
                  {calc ? Math.round(calc.rmr) + " kcal" : "profile incomplete"}{" "}
                  · method: {activeProfile?.method ?? "not configured"}.
                  Habitual expenditure = resting estimate ×{" "}
                  {activeProfile?.factor ?? "—"}. Food target credit = net
                  additional exercise ×{" "}
                  {(activeProfile?.exerciseCredit ?? 0) * 100}%.
                </p>
                <p>
                  Expenditure includes all additional activity marked outside
                  your habitual factor. The credit policy only changes your food
                  target. Remaining = food target − recorded intake. Estimated
                  energy balance = estimated expenditure − intake, and is
                  meaningful only with a complete day. Device energy and
                  equations are estimates.{" "}
                  {calc?.range &&
                    `Without the equation parameter, resting estimates range from ${Math.round(calc.range[0])} to ${Math.round(calc.range[1])} kcal; the displayed center is illustrative.`}
                </p>
              </section>
            )}
            <div className="energy-summary">
              <div>
                <small>Estimated daily expenditure</small>
                <strong>
                  {calc
                    ? Math.round(summary.expenditure!) + " kcal"
                    : "Profile needed"}
                </strong>
              </div>
              <div>
                <small>Extra activity added to food target</small>
                <strong>{Math.round(summary.activityCredit)} kcal</strong>
              </div>
              <div>
                <small>Estimated balance · expenditure minus intake</small>
                <strong>
                  {summary.balance !== null
                    ? Math.round(summary.balance) + " kcal"
                    : "Complete your log to compare"}
                </strong>
              </div>
            </div>
            <div className="two-col">
              <MealList />
              <section className="card">
                <div className="card-title">
                  <h2>A little movement</h2>
                  <Footprints size={19} />
                </div>
                <div className="activity-number">
                  {acts.reduce((n, a) => n + (a.included ? a.minutes : 0), 0)}
                  <span>minutes recorded</span>
                </div>
                <p className="muted">
                  {acts.length
                    ? "Your recorded activities, counted once."
                    : "No activity recorded for this day."}
                </p>
                <button className="secondary" onClick={() => T("Activity")}>
                  View activity <ChevronRight size={16} />
                </button>
                <div className="soft-callout">
                  Rest is part of the adventure, too.
                </div>
              </section>
            </div>
          </>
        )}
        {tab === "Food" && (
          <>
            <MealList />
            <section className="card" data-guide="journal-recipes">
              <h2>Your kitchen notebook</h2>
              <p className="muted">
                Save a recipe from entries on this date. Enter its final cooked
                weight; water changes density, not the sum of ingredients.
              </p>
              <div className="form-grid">
                <label>
                  Recipe name
                  <input
                    value={recipeName}
                    onChange={(e) => R(e.target.value)}
                  />
                </label>
                <label>
                  Final yield (grams)
                  <input
                    type="number"
                    min="1"
                    value={yieldG}
                    onChange={(e) => Y(Number(e.target.value))}
                  />
                </label>
              </div>
              {entries.map((e) => (
                <label className="check" key={e.id}>
                  <input
                    type="checkbox"
                    checked={recipeIds.includes(e.id)}
                    onChange={() =>
                      RI(
                        recipeIds.includes(e.id)
                          ? recipeIds.filter((x) => x !== e.id)
                          : [...recipeIds, e.id],
                      )
                    }
                  />
                  {e.food.name} · {e.amount} g
                </label>
              ))}
              <button
                className="secondary"
                onClick={() => {
                  try {
                    if (!recipeName.trim())
                      throw new Error("Name your recipe.");
                    const f = recipe(
                      recipeName,
                      entries.filter((e) => recipeIds.includes(e.id)),
                      yieldG,
                    );
                    update({ recipes: [...s.recipes, f] });
                    S("Recipe saved. Find it when adding food.");
                    RI([]);
                  } catch (e) {
                    S((e as Error).message);
                  }
                }}
              >
                Save recipe
              </button>
            </section>
          </>
        )}
        {tab === "Activity" && (
          <>
            {(s.healthImports ?? [])
              .filter((h) => h.date === date)
              .map((h) => (
                <section className="card" key={h.id}>
                  <h2>Health Connect · reviewed snapshot</h2>
                  <p>
                    {h.steps} steps ·{" "}
                    {h.activeCalories === null
                      ? "No active energy value"
                      : Math.round(h.activeCalories) +
                        " kcal active energy estimate"}{" "}
                    ·{" "}
                    {h.sleepMinutes === null
                      ? "No sleep record"
                      : h.sleepMinutes + " minutes sleep"}
                  </p>
                  <p className="tiny">
                    {h.sources.join(", ")} ·{" "}
                    {new Date(h.endTime).toLocaleString()}. This imported
                    aggregate is shown separately and is not added to manual
                    workouts or your activity factor.
                  </p>
                </section>
              ))}
            <section className="card">
              <h2>Record a training session</h2>
              <p className="muted">
                Manual MET estimates are approximate. Habitual exercise is
                already included in your activity factor; extra food credit
                defaults to zero.
              </p>
              <form data-guide="journal-activity-form"
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    minutes = Number(f.get("minutes")),
                    met = Number(f.get("met"));
                  if (minutes <= 0 || met < 1) return;
                  update({
                    activities: [
                      ...s.activities,
                      {
                        id: crypto.randomUUID(),
                        name: String(f.get("name")),
                        minutes,
                        met,
                        date,
                        start: `${date}T${f.get("time")}:00`,
                        source: "Manual MET estimate",
                        included: true,
                        additional: f.get("additional") === "on",
                      },
                    ],
                  });
                  S(
                    "Activity recorded. Overlapping intervals are excluded from totals.",
                  );
                  e.currentTarget.reset();
                }}
              >
                <label>
                  Activity
                  <select name="name">
                    <option>Walking</option>
                    <option>Running</option>
                    <option>Cycling</option>
                    <option>Strength training</option>
                    <option>Swimming</option>
                    <option>Other activity</option>
                  </select>
                </label>
                <label>
                  Duration (minutes)
                  <input
                    required
                    name="minutes"
                    type="number"
                    min="1"
                    max="1440"
                    defaultValue="30"
                  />
                </label>
                <label>
                  Start time
                  <input
                    required
                    name="time"
                    type="time"
                    defaultValue="12:00"
                  />
                </label>
                <label>
                  MET (estimated intensity)
                  <input
                    required
                    name="met"
                    type="number"
                    min="1"
                    max="20"
                    step="0.1"
                    defaultValue="3.5"
                  />
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" name="additional" />
                  This session is extra activity outside my usual activity
                  factor.
                </label>
                <p className="tiny">
                  Leave this unchecked for habitual training already included in
                  your profile. Extra activity increases estimated expenditure;
                  your 0%, 50% or 100% policy controls how much is added to your
                  food target.
                </p>
                <button className="primary">Save activity</button>
              </form>
            </section>
            <section className="card">
              <h2>Included once. Explained clearly.</h2>
              {acts.length ? (
                acts.map((a) => (
                  <div className="food-row" key={a.id}>
                    <div className="food-icon">
                      <Footprints />
                    </div>
                    <div>
                      <strong>{a.name}</strong>
                      <p>
                        {a.minutes} min · {a.source} · {a.reason} ·{" "}
                        {a.additional
                          ? "Additional to habitual activity"
                          : a.additional === false
                            ? "Already in habitual activity"
                            : "Historical activity policy"}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        update({
                          activities: s.activities.map((x) =>
                            x.id === a.id ? { ...x, included: !x.included } : x,
                          ),
                        })
                      }
                    >
                      {a.included ? "Exclude" : "Include"}
                    </button>
                    <button
                      aria-label="Delete activity"
                      onClick={() =>
                        update({
                          activities: s.activities.filter((x) => x.id !== a.id),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty">
                  Your first walk, ride or workout will appear here.
                </div>
              )}
              <p className="tiny">
                Net exercise energy = (MET − 1) × 3.5 × kg ÷ 200 × minutes. No
                weight means no calorie estimate. Native step availability is
                shown in the adventure’s device panel.
              </p>
            </section>
          </>
        )}
        {tab === "Progress" && (
          <>
            <Reports state={s} />
            <ProjectionPanel state={s} onChange={set} />
            <div className="two-col">
              <section className="card">
                <h2>Check in with yourself</h2>
                <form data-guide="journal-weight-form"
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget),
                      weight =
                        prefs.units === "imperial"
                          ? lbToKg(Number(f.get("weight")))
                          : Number(f.get("weight"));
                    if (weight <= 0) return;
                    update({
                      weights: [
                        ...s.weights,
                        {
                          id: crypto.randomUUID(),
                          date,
                          weight,
                          bodyFat: f.get("fat")
                            ? Number(f.get("fat"))
                            : undefined,
                        },
                      ],
                    });
                    S("Measurement saved. Daily fluctuations are normal.");
                  }}
                >
                  <label>
                    Weight ({prefs.units === "imperial" ? "lb" : "kg"})
                    <input
                      name="weight"
                      required
                      type="number"
                      min="1"
                      max="500"
                      step="0.1"
                    />
                  </label>
                  <label>
                    Body fat % (optional)
                    <input
                      name="fat"
                      type="number"
                      min="1"
                      max="75"
                      step="0.1"
                    />
                  </label>
                  <button className="primary">Save measurement</button>
                </form>
                <p className="tiny">
                  Hydration, digestion and glycogen can affect weight. A single
                  change is not a measurement of fat gain or loss.
                </p>
              </section>
              <section className="card">
                <h2>Your trend</h2>
                <div className="activity-number">
                  {rollingAverage(s.weights, date)
                    ? displayWeight(
                        rollingAverage(s.weights, date)!,
                        prefs.units,
                      )
                    : "—"}
                  <span>7-day average</span>
                </div>
                {s.weights.length > 1 ? (
                  <svg
                    role="img"
                    aria-label="Recorded weight trend"
                    viewBox="0 0 400 120"
                    className="weight-chart"
                  >
                    <path
                      d={s.weights
                        .slice(-28)
                        .map(
                          (w, i, all) =>
                            `${i ? "L" : "M"}${10 + (i * 380) / Math.max(1, all.length - 1)} ${100 - ((w.weight - Math.min(...all.map((v) => v.weight))) / Math.max(1, Math.max(...all.map((v) => v.weight)) - Math.min(...all.map((v) => v.weight)))) * 80}`,
                        )
                        .join(" ")}
                      fill="none"
                      stroke="#4b8057"
                      strokeWidth="3"
                    />
                  </svg>
                ) : (
                  <p className="muted">
                    Add measurements over time to see a trend.
                  </p>
                )}
              </section>
            </div>
            <section className="card">
              <h2>Measurements</h2>
              {s.weights.map((w) => (
                <div className="food-row" key={w.id}>
                  <span>{w.date}</span>
                  <strong>{displayWeight(w.weight, prefs.units)}</strong>
                  <span>{w.bodyFat ? `${w.bodyFat}% body fat` : ""}</span>
                  <button
                    onClick={() =>
                      update({
                        weights: s.weights.filter((x) => x.id !== w.id),
                      })
                    }
                    aria-label="Delete measurement"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </section>
            <section className="card">
              <h2>Take your journal with you</h2>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() =>
                    download("everstride-diary.csv", csv(s.entries), "text/csv")
                  }
                >
                  <Download size={16} />
                  Export CSV
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    download(
                      "everstride-journal.json",
                      JSON.stringify(s, null, 2),
                      "application/json",
                    )
                  }
                >
                  Full JSON backup
                </button>
                <button className="secondary" onClick={() => window.print()}>
                  Print / Save PDF
                </button>
              </div>
              <p className="tiny">
                Exports contain personal health information. Share only with
                people you choose.
              </p>
            </section>
          </>
        )}
        {tab === "Profile" && (
          <>
            <JournalSettings state={s} onChange={set} />
            <section className="card" data-guide="journal-profile-form">
              <h2>A profile that goes at your pace</h2>
              <p className="muted">
                Everything is optional. Missing inputs mean no personalized
                target; your journal still works.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={profile.eligible}
                  onChange={(e) =>
                    P({ ...profile, eligible: e.target.checked })
                  }
                />
                I am 18 or older, not pregnant or breastfeeding, and do not
                require a medically supervised nutrition plan.
              </label>
              <div className="form-grid">
                {field("Age", "age", "years", 18)}
                {field("Height", "height", "cm", 1)}
                {field("Current weight", "weight", "kg", 1)}
                <label>
                  Equation parameter (optional)
                  <select
                    value={profile.sex ?? ""}
                    onChange={(e) =>
                      P({
                        ...profile,
                        sex: (e.target.value as Profile["sex"]) || undefined,
                      })
                    }
                  >
                    <option value="">Prefer not to specify · show range</option>
                    <option value="female">Female equation parameter</option>
                    <option value="male">Male equation parameter</option>
                  </select>
                </label>
                <label>
                  Resting energy method
                  <select
                    value={profile.method}
                    onChange={(e) =>
                      P({
                        ...profile,
                        method: e.target.value as Profile["method"],
                      })
                    }
                  >
                    <option value="mifflin">Mifflin–St Jeor</option>
                    <option value="katch">
                      Katch–McArdle · requires body fat
                    </option>
                    <option value="measured">
                      Clinical resting measurement
                    </option>
                  </select>
                </label>
                {profile.method === "katch" && (
                  <>
                    {field("Body fat", "bodyFat", "%")}
                    <label>
                      Measurement method
                      <input
                        value={profile.bodyFatMethod ?? ""}
                        onChange={(e) =>
                          P({ ...profile, bodyFatMethod: e.target.value })
                        }
                        placeholder="DEXA, impedance, skinfold…"
                      />
                    </label>
                  </>
                )}
                {profile.method === "measured" &&
                  field(
                    "Measured resting energy",
                    "measuredRmr",
                    "kcal/day",
                    1,
                  )}
                <label>
                  Habitual activity factor
                  <select
                    value={profile.factor}
                    onChange={(e) =>
                      P({ ...profile, factor: Number(e.target.value) })
                    }
                  >
                    {[1.2, 1.375, 1.55, 1.725, 1.9].map((v, i) => (
                      <option value={v} key={v}>
                        {v} ·{" "}
                        {
                          [
                            "Mostly sedentary",
                            "Lightly active",
                            "Moderately active",
                            "Very active",
                            "Highly active",
                          ][i]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Goal
                  <select
                    value={profile.goal}
                    onChange={(e) =>
                      P({ ...profile, goal: e.target.value as Profile["goal"] })
                    }
                  >
                    <option value="maintain">Maintain</option>
                    <option value="lose">Lose weight</option>
                    <option value="gain">Gain weight</option>
                  </select>
                </label>
                {profile.goal !== "maintain" &&
                  field("Energy adjustment", "adjustment", "%", 0)}
                <label>
                  Additional exercise credit
                  <select
                    value={profile.exerciseCredit}
                    onChange={(e) =>
                      P({
                        ...profile,
                        exerciseCredit: Number(e.target.value) as 0 | 0.5 | 1,
                      })
                    }
                  >
                    <option value="0">0% · keep the food target fixed</option>
                    <option value="0.5">
                      50% · add half of extra activity
                    </option>
                    <option value="1">100% · add all extra activity</option>
                  </select>
                </label>
                {field("Protein reference target", "proteinTarget", "g/day")}
              </div>
              <button className="primary" onClick={saveProfile}>
                Save preferences
              </button>
              {energy(profile)?.restricted && (
                <p className="notice">
                  This requested deficit exceeds the app’s conservative limits.
                  Maintenance is shown instead. These limits do not establish
                  medical suitability.
                </p>
              )}
              <p className="tiny">
                Mifflin: 10×kg + 6.25×cm − 5×age + equation constant (+5 or
                −161). Katch: 370 + 21.6×fat-free kg. Neither is a direct
                measurement. A home body-fat scale does not automatically
                improve the estimate.
              </p>
            </section>
            <section className="card">
              <h2>Your data belongs to you</h2>
              <p>
                {storageScope === "cloud"
                  ? "This journal belongs to the cloud adventure. All devices linked to that adventure can read and edit it. Pending changes and conflicts are shown separately. Cached copies on disconnected devices cannot be erased instantly."
                  : "Stored locally in this browser. Opening a cloud adventure uses its separate shared journal; your local diary is not uploaded automatically."}
              </p>
              <p>
                No nutrition AI, advertising, camera uploads or automatic
                weight-loss rewards.
              </p>
              <button
                className="danger"
                onClick={() => {
                  if (
                    confirm(
                      storageScope === "cloud"
                        ? "Delete all food, activity, measurements and nutrition preferences from the shared cloud journal? Linked devices will receive these changes. The adventure stays."
                        : "Delete all food, activity, measurements and nutrition preferences on this device? The adventure stays.",
                    )
                  ) {
                    if (storageScope === "cloud") {
                      if (onDeleteJournal)
                        void Promise.resolve()
                          .then(onDeleteJournal)
                          .then(() => S("Shared journal deletion confirmed."))
                          .catch((error) =>
                            S(
                              error instanceof Error
                                ? error.message
                                : String(error),
                            ),
                          );
                      else
                        S(
                          "Cloud deletion is unavailable. Nothing was deleted.",
                        );
                      return;
                    }
                    set({
                      profile: {
                        method: "mifflin",
                        factor: 1.2,
                        goal: "maintain",
                        adjustment: 10,
                        eligible: false,
                        exerciseCredit: 0,
                      },
                      entries: [],
                      activities: [],
                      weights: [],
                      favorites: [],
                      recipes: [],
                      completeDays: [],
                      goalHistory: [],
                    });
                    S("Journal deleted.");
                  }
                }}
              >
                Delete nutrition data
              </button>
            </section>
          </>
        )}
        <footer className="journal-footer">
          <span>✦ everstride</span>
          <span>
            A journal, not a judgment. Estimates are always estimates.
          </span>
        </footer>
      </main>
      {add && (
        <div className="modal-backdrop">
          <section className="modal food-modal" role="dialog" aria-modal="true" aria-label="Add to your journal" data-guide="journal-food-dialog">
            <div className="card-title">
              <div>
                <div className="eyebrow">A MOMENT TO NOURISH</div>
                <h2>Add to your journal</h2>
              </div>
              <button
                data-guide="journal-food-close"
                onClick={() => {
                  A(false);
                  cancelLookup();
                  setScanning(false);
                }}
                aria-label="Close"
              >
                <X size={22}/>
              </button>
            </div>
            {status && <p className="notice" role="status">{status}</p>}
            {(lookingUp||readingPhoto)&&<button type="button" onClick={()=>{cancelLookup();S("Lookup cancelled. Search again or enter the label.");}}>Cancel lookup</button>}
            {food ? (
              <>
                <h3>{food.name}</h3>
                <p className="tiny">{food.source}</p>
                <div className="form-grid" data-guide="journal-portion">
                  <label>
                    Quantity ({food.basis ?? "g"})
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => G(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Meal
                    <select value={meal} onChange={(e) => M(e.target.value)}>
                      {["Breakfast", "Lunch", "Dinner", "Snacks"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="large-number">
                  {food.per100.kcal === null
                    ? "Unknown"
                    : Math.round(scale(food.per100, amount).kcal!)}{" "}
                  <small>
                    kcal · {date > today() ? "planned" : "to record"}
                  </small>
                </p>
                <div className="button-row">
                  <button className="primary" data-guide="journal-confirm-food" onClick={saveFood}>
                    Confirm {date > today() ? "planned meal" : "food eaten"}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      update({
                        favorites: [
                          ...s.favorites.filter((f) => f.id !== food.id),
                          food,
                        ],
                      });
                      S("Saved to favorites.");
                    }}
                  >
                    <Star size={16} />
                    Favorite
                  </button>
                  {food.barcode && (
                    <button
                      onClick={() => {
                        onDiscover(food.barcode!);
                        S(
                          "Product discovered for alchemy. This does not record consumption.",
                        );
                      }}
                    >
                      Discover ingredient
                    </button>
                  )}
                  <button onClick={() => F(null)}>Back</button>
                </div>
              </>
            ) : (
              <>
                {!scanning&&<FoodSearch onSelect={selectFood} savedFoods={[...s.favorites,...s.recipes,...s.entries.map(e=>e.food)]}/>}
                {scanning&&<BarcodeScanner onCode={code=>void lookup(code)} onClose={()=>{setScanning(false);S('Scanner stopped. Search a name, type the barcode or scan a photo.');}}/>}
                <div className="button-row barcode-actions">
                  {!scanning&&<button type="button" className="secondary" data-guide="journal-scanner" onClick={scan}>
                    <ScanLine size={18}/> Scan a barcode
                  </button>}
                  <label className="secondary barcode-photo-button">Scan a photo
                    <input type="file" accept="image/*" capture="environment" aria-label="Scan a barcode photo" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void scanPhoto(file);}}/>
                  </label>
                </div>
                {!scanning&&<><div className="divider">
                  <span>OR ADD FROM A LABEL</span>
                </div>
                <div className="form-grid" data-guide="journal-manual">
                  {Object.keys(newFood).map((k) => (
                    <label key={k}>
                      {k === "name"
                        ? "Food name"
                        : `${k === "kcal" ? "Energy (kcal)" : k + " (g)"} per 100 g`}
                      <input
                        aria-label={k === "name" ? "Food name" : `${k === "kcal" ? "Energy (kcal)" : k + " (g)"} per 100 g`}
                        type={k === "name" ? "text" : "number"}
                        min="0"
                        step="any"
                        value={newFood[k as keyof typeof newFood]}
                        onChange={(e) => N({ ...newFood, [k]: e.target.value })}
                        placeholder={
                          k === "name"
                            ? "e.g. Homemade lentil soup"
                            : "Unknown if blank"
                        }
                      />
                    </label>
                  ))}
                </div>
                <button className="primary" data-guide="journal-manual-review" onClick={manual}>
                  Review portion <ChevronRight size={16} />
                </button>
                <p className="tiny">
                  Open Food Facts: community-contributed product data, ODbL.
                  Check the packaging. Missing nutrients stay unknown.
                </p></>}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
  function MealList() {
    return (
      <section className="card meals">
        <div className="card-title">
          <h2>On the menu</h2>
          <button className="text-button" onClick={() => A(true)}>
            Add food <Plus size={15} />
          </button>
        </div>
        {["Breakfast", "Lunch", "Dinner", "Snacks"].map((m, i) => {
          const list = s.entries.filter((e) => e.date === date && e.meal === m);
          return (
            <div className="meal-section" key={m}>
              <div className="meal-heading">
                <span className="meal-icon">{["☀", "◒", "☾", "✧"][i]}</span>
                <strong>{m}</strong>
                <small>
                  {list.length
                    ? `${total(list).kcal === null ? "Unknown" : Math.round(total(list).kcal!)} kcal`
                    : "A fresh page"}
                </small>
                <button
                  aria-label={`Add ${m}`}
                  onClick={() => {
                    M(m);
                    A(true);
                  }}
                >
                  <Plus size={17} />
                </button>
              </div>
              {list.map((e) => (
                <div className="food-row" key={e.id}>
                  <div>
                    <strong>
                      {e.food.name}
                      {e.planned ? " · planned" : ""}
                    </strong>
                    <p>
                      {e.amount} {e.food.basis ?? "g"} ·{" "}
                      {e.food.source.split("·")[0]}
                    </p>
                  </div>
                  <span>
                    {e.food.per100.kcal === null
                      ? "Unknown"
                      : Math.round((e.food.per100.kcal * e.amount) / 100)}{" "}
                    kcal
                  </span>
                  <button
                    aria-label="Edit quantity"
                    onClick={() => {
                      const v = prompt(
                        "New quantity in " + (e.food.basis ?? "g"),
                        String(e.amount),
                      );
                      if (v && Number(v) > 0)
                        update({
                          entries: s.entries.map((x) =>
                            x.id === e.id ? { ...x, amount: Number(v) } : x,
                          ),
                        });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    aria-label="Copy food to today"
                    onClick={() =>
                      update({
                        entries: [
                          ...s.entries,
                          {
                            ...structuredClone(e),
                            id: crypto.randomUUID(),
                            date: today(),
                            planned: false,
                          },
                        ],
                      })
                    }
                  >
                    Copy
                  </button>
                  <button
                    aria-label="Delete food"
                    onClick={() =>
                      update({
                        entries: s.entries.filter((x) => x.id !== e.id),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </section>
    );
  }
}
