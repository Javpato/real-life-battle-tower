export type Nutrients = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber?: number | null;
};
export type Food = {
  id: string;
  name: string;
  brand?: string;
  per100: Nutrients;
  source: string;
  barcode?: string;
  image?: string;
  basis?: "g" | "ml";
};
export type Entry = {
  id: string;
  food: Food;
  amount: number;
  date: string;
  meal: string;
  planned: boolean;
  createdAt: string;
};
export type Profile = {
  age?: number;
  height?: number;
  weight?: number;
  sex?: "male" | "female";
  bodyFat?: number;
  bodyFatMethod?: string;
  method: "mifflin" | "katch" | "measured";
  measuredRmr?: number;
  factor: number;
  goal: "maintain" | "lose" | "gain";
  adjustment: number;
  eligible: boolean;
  targetWeight?: number;
  exerciseCredit: 0 | 0.5 | 1;
  proteinTarget?: number;
};
export type Activity = {
  id: string;
  name: string;
  date: string;
  minutes: number;
  met: number;
  start: string;
  source: string;
  externalId?: string;
  included: boolean;
  /** Explicitly outside the habitual activity factor; false avoids duplicate energy. */
  additional?: boolean;
};
export type Measurement = {
  id: string;
  date: string;
  weight: number;
  bodyFat?: number;
  waist?: number;
};
export type NutritionState = {
  healthImports?: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    steps: number;
    sleepMinutes: number | null;
    activeCalories: number | null;
    weightKg: number | null;
    sources: string[];
  }>;
  profile: Profile;
  entries: Entry[];
  activities: Activity[];
  weights: Measurement[];
  favorites: Food[];
  recipes: Food[];
  completeDays: string[];
  goalHistory: { date: string; profile: Profile }[];
};
export const defaultNutrition = (): NutritionState => ({
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
export const today = () => localDate(new Date());
export function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const mifflin = (
  kg: number,
  cm: number,
  age: number,
  sex: "male" | "female",
) => 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
export const katch = (kg: number, bf: number) =>
  370 + 21.6 * kg * (1 - bf / 100);
export function energy(p: Profile) {
  if (
    !p.eligible ||
    !Number.isFinite(p.age) ||
    !p.age ||
    p.age < 18 ||
    p.age > 120 ||
    !Number.isFinite(p.factor) ||
    p.factor < 1 ||
    p.factor > 2.5 ||
    !Number.isFinite(p.adjustment) ||
    p.adjustment < 0 ||
    p.adjustment > 100
  )
    return null;
  let rmr: number;
  let range: [number, number] | undefined;
  if (p.method === "measured") {
    if (
      !p.measuredRmr ||
      !Number.isFinite(p.measuredRmr) ||
      p.measuredRmr <= 0 ||
      p.measuredRmr > 6000
    )
      return null;
    rmr = p.measuredRmr;
  } else {
    if (
      !p.weight ||
      !Number.isFinite(p.weight) ||
      p.weight <= 0 ||
      p.weight > 500
    )
      return null;
    if (p.method === "katch") {
      if (
        p.bodyFat === undefined ||
        !Number.isFinite(p.bodyFat) ||
        p.bodyFat <= 0 ||
        p.bodyFat >= 100 ||
        !p.bodyFatMethod
      )
        return null;
      rmr = katch(p.weight, p.bodyFat);
    } else {
      if (
        !p.height ||
        !Number.isFinite(p.height) ||
        p.height <= 0 ||
        p.height > 300
      )
        return null;
      if (p.sex) rmr = mifflin(p.weight, p.height, p.age, p.sex);
      else {
        range = [
          mifflin(p.weight, p.height, p.age, "female"),
          mifflin(p.weight, p.height, p.age, "male"),
        ];
        rmr = (range[0] + range[1]) / 2;
      }
    }
  }
  if (!Number.isFinite(rmr) || rmr <= 0) return null;
  const tdee = rmr * p.factor;
  let delta = p.goal === "maintain" ? 0 : (tdee * p.adjustment) / 100;
  const restricted =
    p.goal === "lose" &&
    (delta > Math.min(tdee * 0.2, 500) ||
      tdee - delta < rmr ||
      (p.weight && p.height && p.weight / (p.height / 100) ** 2 < 18.5));
  if (restricted) delta = 0;
  const target = tdee + (p.goal === "lose" ? -delta : delta);
  return {
    rmr,
    tdee,
    target,
    restricted: !!restricted,
    range,
    method: p.method,
  };
}
export function scale(n: Nutrients, amount: number): Nutrients {
  return Object.fromEntries(
    Object.entries(n).map(([k, v]) => [
      k,
      v === null ? null : (v * amount) / 100,
    ]),
  ) as Nutrients;
}
export function total(entries: Entry[]): Nutrients {
  const keys = ["kcal", "protein", "carbs", "fat", "fiber"] as const;
  return Object.fromEntries(
    keys.map((k) => [
      k,
      entries.some((e) => e.food.per100[k] == null)
        ? null
        : entries.reduce(
            (n, e) => n + ((e.food.per100[k] ?? 0) * e.amount) / 100,
            0,
          ),
    ]),
  ) as Nutrients;
}
export function incrementalEnergy(a: Activity, kg: number) {
  return ((Math.max(0, a.met - 1) * 3.5 * kg) / 200) * a.minutes;
}
export function reconcile(activities: Activity[]) {
  const accepted: Activity[] = [];
  return activities.map((a) => {
    const overlap = accepted.some(
      (b) =>
        a.date === b.date &&
        ((a.externalId &&
          a.externalId === b.externalId &&
          a.source === b.source) ||
          (a.start &&
            b.start &&
            Date.parse(a.start) < Date.parse(b.start) + b.minutes * 60000 &&
            Date.parse(b.start) < Date.parse(a.start) + a.minutes * 60000)),
    );
    const included = a.included && !overlap;
    if (included) accepted.push(a);
    return {
      ...a,
      included,
      reason: overlap
        ? "Overlapping interval — excluded"
        : a.included
          ? "Included once"
          : "Excluded by you",
    };
  });
}
export function recipe(
  name: string,
  ingredients: Entry[],
  yieldGrams: number,
): Food {
  if (!ingredients.length || !Number.isFinite(yieldGrams) || yieldGrams <= 0)
    throw new Error("Add ingredients and a positive final cooked weight.");
  const sum = total(ingredients);
  return {
    id: crypto.randomUUID(),
    name,
    per100: scale(sum, 10000 / yieldGrams),
    source: `Your recipe · ${ingredients.length} ingredients · yield ${yieldGrams} g`,
    basis: "g",
  };
}
export function rollingAverage(weights: Measurement[], date: string, days = 7) {
  const end = Date.parse(date);
  const values = weights.filter((w) => {
    const d = end - Date.parse(w.date);
    return d >= 0 && d < days * 86400000;
  });
  return values.length
    ? values.reduce((s, w) => s + w.weight, 0) / values.length
    : null;
}
export function csv(entries: Entry[]) {
  const esc = (s: unknown) => `"${String(s ?? "").replaceAll('"', '""')}"`;
  return [
    "date,meal,food,quantity,basis,kcal,protein,carbs,fat,source,planned",
    ...entries.map((e) =>
      [
        e.date,
        e.meal,
        e.food.name,
        e.amount,
        e.food.basis ?? "g",
        ...Object.values(
          scale(
            {
              kcal: e.food.per100.kcal,
              protein: e.food.per100.protein,
              carbs: e.food.per100.carbs,
              fat: e.food.per100.fat,
            },
            e.amount,
          ),
        ),
        e.food.source,
        e.planned,
      ]
        .map(esc)
        .join(","),
    ),
  ].join("\n");
}
export async function lookupBarcode(code: string): Promise<Food> {
  if (!/^\d{8,14}$/.test(code))
    throw new Error("Enter an 8–14 digit product barcode.");
  const r = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,nutriments,image_front_small_url,nutrition_data_per`,
    { signal: AbortSignal.timeout(12000) },
  );
  if (!r.ok) throw new Error("Product service unavailable. Try manual entry.");
  const data = await r.json();
  if (data.status !== 1)
    throw new Error("Product not found. You can add its label manually.");
  const p = data.product,
    n = p.nutriments ?? {};
  const read = (key: string) =>
    typeof n[key] === "number" && Number.isFinite(n[key]) && n[key] >= 0
      ? n[key]
      : null;
  return {
    id: code,
    barcode: code,
    basis: p.nutrition_data_per === "100ml" ? "ml" : "g",
    name: p.product_name || "Unnamed product",
    brand: p.brands,
    source: `Open Food Facts · retrieved ${today()} · community label, check packaging`,
    image: p.image_front_small_url,
    per100: {
      kcal: read("energy-kcal_100g"),
      protein: read("proteins_100g"),
      carbs: read("carbohydrates_100g"),
      fat: read("fat_100g"),
      fiber: read("fiber_100g"),
    },
  };
}

/** Historical dates use the last profile version actually established by that day. */
export function profileForDate(
  state: NutritionState,
  date: string,
): Profile | null {
  if (date >= today()) return state.profile;
  const versions = state.goalHistory
    .filter((v) => localDate(new Date(v.date)) <= date)
    .sort((a, b) => a.date.localeCompare(b.date));
  return versions.at(-1)?.profile ?? null;
}
