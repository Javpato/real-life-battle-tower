import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output = "docs/verification/exercise-guides";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(
    `${process.env.GAME_URL ?? "http://127.0.0.1:5189"}/tests/fixtures/exercise-guides.html`,
  );
  await page.getByRole("combobox").waitFor();
  const ids = await page
    .locator("option")
    .evaluateAll((options) => options.map((option) => option.value));
  if (ids.length !== 90) throw Error("Unexpected catalogue coverage");
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1280, 720],
    [915, 412],
    [800, 360],
  ]) {
    await page.setViewportSize({ width, height });
    for (const id of ids) {
      await page.getByRole("combobox").selectOption(id);
      await page.locator(`[data-motion-skill="${id}"]`).waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      if (overflow) throw Error(`Overflow ${id} at ${width}`);
    }
  }
  for (const id of [
    "deadbug",
    "wall-pushup",
    "advanced-birddog",
    "cat-cow",
    "abdominal-brace",
    "sitstand",
    "standing-side-leg-raise",
    "prone-w",
  ]) {
    await page.getByRole("combobox").selectOption(id);
    await page.getByRole("button", { name: /Step 2:/ }).click();
    await page.screenshot({ path: `${output}/${id}-800.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Step 1: START" }).click();
  await page.getByRole("button", { name: "Play sequence" }).click();
  await page.waitForTimeout(1950);
  if (!(await page.locator(".motion-phase").innerText()).includes("LIFT"))
    throw Error("Playback did not advance");
  await page.getByRole("button", { name: "Pause sequence" }).click();
  const paused = await page.locator(".motion-phase").innerText();
  await page.waitForTimeout(1950);
  if ((await page.locator(".motion-phase").innerText()) !== paused)
    throw Error("Pause did not stop playback");
  await page.getByRole("checkbox", { name: "Reduced motion" }).check();
  await page.waitForTimeout(100);
  if (await page.getByRole("button", { name: "Play sequence" }).count())
    throw Error("Game reduced motion not applied");
  await page.getByRole("checkbox", { name: "Reduced motion" }).uncheck();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  if (await page.getByRole("button", { name: "Play sequence" }).count())
    throw Error("System reduced motion not applied");
  if (errors.length) throw Error(errors.join("\n"));
  const report = {
    skills: ids.length,
    viewports: 5,
    renders: ids.length * 5,
    errors,
    playPause: "passed",
    reducedMotion: "system and game passed",
    scope: "Instructional diagrams; no physical camera validation",
  };
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await browser.close();
}
