/** Production-only offline acceptance through the Cozylight/three-slot opening.
 * Creates a real UI save and moves using keyboard; never seeds adventure state. */
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const slots = async () => {
    await expect(
      page.getByRole("button", { name: "PRESS ANYTHING TO START" }),
    ).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "PRESS ANYTHING TO START" }).click();
    await expect(page.locator(".save-slot")).toHaveCount(3);
  };
  const saved = () =>
    page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("everstride");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const result = await new Promise((resolve, reject) => {
        const tx = db.transaction("state"),
          store = tx.objectStore("state"),
          r = store.get("save-slots:v1");
        r.onsuccess = () => {
          const slot = r.result[0];
          const q = store.get(`adventure:${slot.saveId}`);
          q.onsuccess = () => resolve({ slot, snapshot: q.result });
          q.onerror = () => reject(q.error);
        };
        r.onerror = () => reject(r.error);
      });
      db.close();
      return result;
    });
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4173");
  await slots();
  await page
    .getByRole("button", { name: /New adventure/ })
    .first()
    .click();
  await page.getByRole("button", { name: /The adventurer Neutral/ }).click();
  await page.getByRole("button", { name: /Choose this character/ }).click();
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Offline Adventurer");
  await page.getByRole("button", { name: /Begin adventure/ }).click();
  await page
    .getByRole("button", { name: "Skip introduction", exact: true })
    .click();
  await expect(page.locator(".world-frame canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Skip tutorial", exact: true })
    .click();
  const original = await saved();
  await page.keyboard.down("d");
  await page.waitForTimeout(450);
  await page.keyboard.up("d");
  await expect
    .poll(async () => (await saved()).snapshot.journey.location.x)
    .toBeGreaterThan(original.snapshot.journey.location.x);
  await expect
    .poll(async () => (await saved()).snapshot.journey.tutorialStage)
    .toBe(6);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Save & return to title", exact: true })
    .click();
  await expect(page.locator(".save-slot")).toHaveCount(3);
  const before = await saved();
  assert.equal(before.snapshot.journey.avatar, "female");
  assert.equal(before.snapshot.journey.introComplete, true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await slots();
  await expect(page.locator(".save-slot").first()).toContainText(
    "Offline Adventurer",
  );
  await expect(page.locator(".save-slot").first()).toContainText(
    "ONLY ON THIS DEVICE",
  );
  await expect(page.locator(".save-slot.empty")).toHaveCount(2);
  await page.screenshot({ path: "/tmp/everstride-overhaul-offline-slots.png" });
  await page
    .getByRole("button", { name: /Continue/ })
    .first()
    .click();
  await expect(page.locator(".world-frame canvas")).toBeVisible();
  await expect(page.locator(".game-hud-player")).toContainText(
    "Offline Adventurer",
  );
  await expect(
    page.getByRole("button", { name: "Skip introduction", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Skip tutorial", exact: true }),
  ).toHaveCount(0);
  const after = await saved();
  assert.equal(after.slot.saveId, before.slot.saveId);
  assert.deepEqual(
    after.snapshot.journey.location,
    before.snapshot.journey.location,
  );
  for (const key of [
    "name",
    "level",
    "xp",
    "coins",
    "hp",
    "badges",
    "defeated",
    "equipped",
  ])
    assert.deepEqual(
      after.snapshot.player[key],
      before.snapshot.player[key],
      key + " persists offline",
    );
  assert.equal(after.snapshot.journey.avatar, "female");
  // Phaser entry fade starts after its canvas becomes visible.
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/everstride-overhaul-offline-world.png" });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Nutrition journal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A good day starts here." }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/everstride-overhaul-offline-journal.png",
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      production: true,
      seededAdventure: false,
      checks: [
        "production worker installed and controlling",
        "UI-created female slot saved after keyboard movement",
        "offline logo/title/three-slot reload",
        "offline continue preserves position/avatar/progression",
        "completed intro/tutorial not repeated",
        "empty slots remain empty",
        "offline journal accessible",
      ],
      errors,
    }),
  );
} finally {
  await browser.close();
}
