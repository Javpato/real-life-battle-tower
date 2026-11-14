/** Isolated presentation fixture, not a physical movement test. */
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5204");
  await page.evaluate(async () => {
    for (const id of ["lunge", "squat", "bridge", "birddog"])
      localStorage.setItem("everstride-guide-" + id, "seen");
    const React = (await import("/node_modules/.vite/deps/react.js")).default,
      domModule = await import("/node_modules/.vite/deps/react-dom_client.js"),
      createRoot = (domModule.default ?? domModule).createRoot,
      { default: Camera } = await import("/src/exercises/ExerciseCamera.tsx");
    const fixture = document.createElement("main");
    fixture.id = "presentation-fixture";
    fixture.className = "immersive-game mode-battle is-series input-camera";
    fixture.style.cssText =
      "position:fixed;inset:0;z-index:100000;background:#09251e;overflow:hidden";
    const style = document.createElement("style");
    style.textContent =
      "#presentation-camera{position:absolute;left:40%;right:0;top:56px;bottom:74px;padding:8px;box-sizing:border-box}#presentation-dock{position:absolute;left:0;right:0;bottom:0;height:64px;display:grid;place-items:center;background:#163d2c}#presentation-dock button{min-height:44px;width:150px}@media(max-height:600px) and (orientation:landscape){#presentation-camera{left:0;top:46px;bottom:58px;padding:5px}#presentation-dock{height:54px}}@media(max-width:600px) and (orientation:portrait){#presentation-camera{left:0;top:152px;bottom:82px;padding:5px}#presentation-dock{height:72px}}";
    document.head.append(style);
    const mount = document.createElement("section");
    mount.id = "presentation-camera";
    fixture.append(mount);
    const dock = document.createElement("div");
    dock.id = "presentation-dock";
    dock.innerHTML = "<button>Rest</button>";
    fixture.append(dock);
    document.body.append(fixture);
    const root = createRoot(mount);
    root.render(
      React.createElement(Camera, {
        exerciseId: "lunge",
        sessionId: "presentation",
        lastSide: "left",
        target: 20,
        progress: 12,
        active: true,
        muted: true,
        mode: "camera",
        onUnit: () => false,
      }),
    );
  });
  const results = [];
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [915, 412],
    [844, 390],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    const camera = page.locator("#presentation-camera"),
      counter = camera.getByTestId("exercise-count");
    await expect(counter).toHaveText("12");
    await expect(camera.getByText("RIGHT LEG", { exact: true })).toBeVisible();
    const measurements = await page.evaluate(() => {
      const root = document.getElementById("presentation-camera"),
        camera = root.querySelector(".exercise-camera"),
        hud = root.querySelector(".exercise-hud"),
        feed = root.querySelector(".exercise-feed"),
        number = root.querySelector('[data-testid="exercise-count"]');
      const inside = (el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          visible:
            r.top >= 0 &&
            r.left >= 0 &&
            r.right <= innerWidth + 1 &&
            r.bottom <= innerHeight + 1,
          hit: el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          ),
        };
      };
      return {
        counter: inside(number),
        font: parseFloat(getComputedStyle(number).fontSize),
        feedback: inside(root.querySelector(".exercise-big-feedback")),
        side: inside(root.querySelector(".exercise-next-side")),
        pause: inside(
          [...root.querySelectorAll("button")].find((x) =>
            x.textContent.includes("Pause / rest"),
          ),
        ),
        rest: inside(document.querySelector("#presentation-dock button")),
        feed: inside(feed),
        hud: inside(hud),
        overflow: camera.scrollHeight > camera.clientHeight + 2,
        feedOverlapsHud:
          feed.getBoundingClientRect().right >
            hud.getBoundingClientRect().left + 1 &&
          feed.getBoundingClientRect().bottom >
            hud.getBoundingClientRect().top + 1,
      };
    });
    expect(measurements.font).toBeGreaterThanOrEqual(
      height < 600 ? 80 : width < 600 ? 72 : 110,
    );
    for (const key of ["counter", "feedback", "side", "pause", "rest"]) {
      expect(
        measurements[key].visible,
        `${width}x${height} ${key} visible`,
      ).toBe(true);
      expect(measurements[key].hit, `${width}x${height} ${key} uncovered`).toBe(
        true,
      );
    }
    expect(measurements.overflow, `${width}x${height} internal overflow`).toBe(
      false,
    );
    expect(measurements.feedOverlapsHud).toBe(false);
    await page.screenshot({
      path: `/tmp/everstride-presentation-${width}x${height}.png`,
    });
    results.push({ width, height, ...measurements });
  }
  await page.getByText("Camera settings", { exact: true }).click();
  await expect(page.getByLabel("Camera facing", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Show skeleton overlay")).toBeVisible();
  await page.getByLabel("Show skeleton overlay").uncheck();
  await expect(page.locator("#presentation-camera canvas")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await page.getByText("Camera settings", { exact: true }).click();
  await page.getByText("STARTING POSITION", { exact: true }).click();
  await expect(page.locator(".exercise-posture-popover")).toBeVisible();
  await expect(
    page
      .locator(".exercise-posture-popover")
      .getByText(/Stand upright with feet/),
  ).toBeVisible();
  await page.getByText("STARTING POSITION", { exact: true }).click();
  const guide = page.getByRole("button", { name: "Show guide", exact: true });
  await guide.click();
  await page
    .getByRole("button", { name: "Close exercise guide", exact: true })
    .click();
  await expect(page.locator(".exercise-guide-popover")).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(page.locator(".exercise-guide-popover")).toHaveCount(0);
  const voice = page.getByRole("button", { name: "Voice coach", exact: true });
  await expect(voice).toHaveAttribute("aria-pressed", "true");
  await voice.click();
  await expect(voice).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      passed: true,
      syntheticPresentation: true,
      results,
      errors,
    }),
  );
} finally {
  await browser.close();
}
