import { walkToFirstTrainer } from "./browser-controls.mjs";
import { chromium, expect } from "@playwright/test";
// Real navigation and UI interaction; no save injection, camera simulation or rewards.
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const hold = async (key, time) => {
  await page.keyboard.down(key);
  try {
    await page.waitForTimeout(time);
  } finally {
    await page.keyboard.up(key);
  }
};
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Take the first step" }).click();
  await expect(
    page.getByText("Opening the village…", { exact: true }),
  ).toHaveCount(0);
  await page.waitForTimeout(400);
  await walkToFirstTrainer(page);
  await page.getByLabel("Use camera verification").uncheck();
  await page.getByRole("button", { name: "Begin encounter" }).click();
  const reports = [];
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["landscape", 844, 390],
    ["portrait", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const rect = (selector) => {
        const b = document.querySelector(selector).getBoundingClientRect();
        return {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          right: b.right,
          bottom: b.bottom,
        };
      };
      return {
        viewport: innerWidth,
        stage: rect(".battle-stage"),
        dock: rect(".battle-actions"),
        enemy: rect(".combat-sprite.enemy"),
        hero: rect(".combat-sprite.hero"),
        enemyHP: rect(".enemy-plate"),
        heroHP: rect(".hero-plate"),
      };
    });
    expect(r.stage.x).toBeGreaterThanOrEqual(0);
    expect(r.stage.right).toBeLessThanOrEqual(width);
    expect(r.stage.width).toBeGreaterThanOrEqual(width - 2);
    expect(r.stage.y + r.stage.height + r.dock.height).toBeGreaterThanOrEqual(
      height - 2,
    );
    expect(Math.abs(r.stage.bottom - r.dock.y)).toBeLessThanOrEqual(2);
    for (const sprite of [r.hero, r.enemy]) {
      expect(sprite.x).toBeGreaterThanOrEqual(r.stage.x);
      expect(sprite.right).toBeLessThanOrEqual(r.stage.right + 1);
      expect(sprite.y).toBeGreaterThanOrEqual(r.stage.y - 1);
      expect(sprite.bottom).toBeLessThanOrEqual(r.stage.bottom);
    }
    for (const plate of [r.heroHP, r.enemyHP])
      expect(plate.right).toBeLessThanOrEqual(r.stage.right);
    await page
      .locator(".battle-stage")
      .screenshot({ path: `/tmp/everstride-battle-layout-${name}.png` });
    reports.push({ name, width: r.stage.width, height: r.stage.height });
  }
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ passed: true, reports, errors }));
} finally {
  await browser.close();
}
