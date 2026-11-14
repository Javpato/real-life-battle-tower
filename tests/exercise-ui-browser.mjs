/** Synthetic UI fixture only. No body recognition or physical accuracy is claimed. */
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173");
  await page.evaluate(async () => {
    // Use the app's exact versioned Vite modules; unversioned URLs create a second React instance.
    const [hudSource, entrySource] = await Promise.all([
      fetch("/src/exercises/ExerciseHUD.tsx").then((response) =>
        response.text(),
      ),
      fetch("/src/main.tsx").then((response) => response.text()),
    ]);
    const reactUrl = hudSource.match(/["']([^"']*\/react\.js[^"']*)["']/)?.[1];
    const domUrl = entrySource.match(
      /["']([^"']*\/react-dom_client\.js[^"']*)["']/,
    )?.[1];
    if (!reactUrl || !domUrl)
      throw Error("Could not resolve the application's React fixture modules");
    const reactModule = await import(reactUrl),
      domModule = await import(domUrl),
      { default: HUD } = await import("/src/exercises/ExerciseHUD.tsx");
    const React = reactModule.default ?? reactModule,
      createRoot = (domModule.default ?? domModule).createRoot;
    await import("/src/exercises/exercises.css");
    const fixture = document.createElement("div");
    fixture.id = "exercise-hud-fixture";
    fixture.style.cssText =
      "position:fixed;inset:0;background:#07191f;z-index:10000;padding:20px;overflow:auto;display:grid;place-items:start center";
    document.body.append(fixture);
    const root = createRoot(fixture);
    window.renderHud = (extra = {}) =>
      root.render(
        React.createElement(
          "div",
          { style: { width: "min(100%,700px)" } },
          React.createElement(HUD, {
            exerciseId: "lunge",
            progress: 3,
            target: 12,
            status: "valid",
            message: "Verified repetition. Well done.",
            nextSide: "right",
            quality: 92,
            paused: false,
            active: true,
            muted: true,
            ...extra,
          }),
        ),
      );
    window.renderHud();
  });
  const hud = page.getByRole("region", { name: "Exercise progress" });
  await expect(hud.getByText("RIGHT", { exact: true })).toBeVisible();
  await expect(
    hud.getByText("STARTING POSITION", { exact: false }),
  ).toBeVisible();
  await expect(hud.getByTestId("exercise-count")).toHaveText("3");
  await expect(hud.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "3",
  );
  const large = await hud
    .getByTestId("exercise-count")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  if (large < 80) throw Error("Desktop counter is too small");
  await page.screenshot({ path: "/tmp/everstride-hud-desktop.png" });
  await page.evaluate(() =>
    window.renderHud({
      paused: true,
      status: "insufficient",
      message: "Show your right ankle.",
    }),
  );
  await expect(
    hud.getByText("REST — NO TIME LIMIT", { exact: true }),
  ).toBeVisible();
  await expect(hud.getByTestId("exercise-count")).toHaveText("3");
  await page.evaluate(() =>
    window.renderHud({
      exerciseId: "superman",
      progress: 12,
      target: 20,
      status: "hold",
      nextSide: undefined,
      message: "Hold steady. Breathe normally.",
    }),
  );
  await expect(hud.getByText("SECONDS", { exact: true })).toBeVisible();
  const startingDetails = hud.locator("details.exercise-start-position");
  if (
    (await startingDetails.count()) &&
    !(await startingDetails.evaluate((element) => element.open))
  )
    await startingDetails.locator("summary").click();
  await expect(
    hud.getByText("Lie face down, legs extended behind you", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: "/tmp/everstride-hud-landscape.png" });
  const mobile = await hud
    .getByTestId("exercise-count")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  if (mobile < 72) throw Error("Landscape counter is too small");
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () =>
      document.getElementById("exercise-hud-fixture").scrollWidth >
      innerWidth + 1,
  );
  if (overflow) throw Error("HUD overflows narrow mobile");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    JSON.stringify({
      passed: true,
      synthetic: true,
      desktopCounterPx: large,
      landscapeCounterPx: mobile,
      checks: [
        "large counter",
        "anatomical next side",
        "initial position visible",
        "progress retained during pause",
        "static hold seconds",
        "portrait no horizontal overflow",
      ],
      errors,
    }),
  );
} finally {
  await browser.close();
}
