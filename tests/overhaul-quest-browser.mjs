/** Reproduce the user-reported quest close/manual lock, including interaction while walking. */
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.GAME_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const checks = [],
  errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const title = async () => {
    await expect(
      page.getByRole("button", { name: "PRESS ANYTHING TO START" }),
    ).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "PRESS ANYTHING TO START" }).click();
    await expect(page.locator(".save-slot")).toHaveCount(3);
  };
  const close = async (label) => {
    const modal = page
      .locator(".modal-backdrop, .opening-modal-backdrop")
      .filter({
        has: page.getByRole("button", { name: "Close", exact: true }),
      });
    await modal.getByRole("button", { name: "Close", exact: true }).click();
    await expect(modal).toHaveCount(0, { timeout: 1000 });
    checks.push(`${label}: one-click close`);
  };
  await page.goto(base);
  await title();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await close("Opening settings");
  await page
    .getByRole("button", { name: /New adventure/ })
    .first()
    .click();
  await page.getByRole("button", { name: /The adventurer Neutral/ }).click();
  await page.getByRole("button", { name: /Choose this character/ }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Camera QA");
  await page.getByRole("button", { name: /Begin adventure/ }).click();
  await page
    .getByRole("button", { name: "Skip introduction", exact: true })
    .click();
  await expect(page.locator(".immersive-game")).toBeVisible();
  checks.push("Female slot created through UI; introduction skipped");
  const menu = () =>
    page.getByRole("button", { name: "Settings", exact: true }).click();
  // Return through real UI before changing a test-only saved location.
  const relocate = async (mapId, x, y) => {
    await menu();
    await page
      .getByRole("button", { name: "Save & return to title", exact: true })
      .click();
    await expect(page.locator(".save-slot")).toHaveCount(3);
    await page.evaluate(
      async ({ mapId, x, y }) => {
        const db = await new Promise((resolve, reject) => {
          const r = indexedDB.open("everstride");
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
        await new Promise((resolve, reject) => {
          const tx = db.transaction("state", "readwrite"),
            store = tx.objectStore("state");
          const r = store.get("save-slots:v1");
          r.onsuccess = () => {
            const id = r.result[0].saveId;
            const q = store.get(`adventure:${id}`);
            q.onsuccess = () => {
              const s = q.result;
              s.journey.location = { mapId, x, y, facing: "up" };
              s.player.position = { x, y };
              store.put(s, `adventure:${id}`);
            };
          };
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      },
      { mapId, x, y },
    );
    await page.reload();
    await title();
    await page
      .getByRole("button", { name: /Continue/ })
      .first()
      .click();
    await expect(page.locator(".immersive-game")).toBeVisible();
  };
  await relocate("summit_house", 192, 150);
  const openQuest = async (moving = false) => {
    await expect(
      page.getByRole("button", { name: "E · Finn", exact: true }),
    ).toBeVisible();
    if (moving) {
      await page.keyboard.down("w");
      await page.waitForTimeout(100);
    }
    await page.keyboard.press("e");
    if (moving) await page.keyboard.up("w");
    await expect(page.locator(".exercise-quest-modal")).toBeVisible();
    await page.waitForTimeout(150);
  };
  await openQuest();
  await page.getByRole("button", { name: "Leave quest", exact: true }).click();
  await expect(page.locator(".exercise-quest-modal")).toHaveCount(0);
  checks.push("Stationary quest closes once");
  await page.waitForTimeout(450);
  await openQuest(true);
  const quest = page.locator(".exercise-quest-modal");
  await quest.getByLabel("Use camera", { exact: true }).uncheck();
  await page.screenshot({
    path: "/tmp/everstride-quest-manual-diagnostic.png",
  });
  const state = await page.locator("body").innerText();
  console.log(
    JSON.stringify({
      hasActionError: state.includes("Action stopped"),
      error: state.match(/Action stopped[^\n]*/)?.[0],
      manualDisabled: await quest
        .getByRole("button", { name: "I completed the exercise", exact: true })
        .isDisabled(),
    }),
  );
  await expect(
    quest.getByRole("button", {
      name: "I completed the exercise",
      exact: true,
    }),
  ).toBeEnabled();
  await quest
    .getByRole("button", { name: "I completed the exercise", exact: true })
    .click();
  await quest
    .getByRole("button", { name: "Collect reward", exact: true })
    .click();
  await expect(quest).toHaveCount(0);
  checks.push("Moving interaction allows manual quest completion and reward");
  await page.waitForTimeout(450);
  await openQuest(true);
  await page.getByRole("button", { name: "Leave quest", exact: true }).click();
  await expect(quest).toHaveCount(0);
  checks.push("Moving interaction quest closes once");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks,
      testLocationFixtures: ["summit_house"],
      physicalExerciseValidation: false,
      errors,
    }),
  );
} finally {
  await browser.close();
}
