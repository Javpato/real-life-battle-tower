/** Real App/UI creation and modal checks. Explicit location fixtures isolate shop/camera
 * regressions from map traversal. Synthetic pose worker is NOT physical validation. */
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
  await page.addInitScript(() => {
    window.__fixtureMotion = "ready";
    window.Worker = class SyntheticPoseWorker {
      onmessage = null;
      stopped = false;
      timestamp = 0;
      cycle = 0;
      terminate() {
        this.stopped = true;
      }
      postMessage(message) {
        if (message.type === "init") {
          queueMicrotask(() => {
            if (!this.stopped) this.onmessage?.({ data: { type: "ready" } });
          });
          return;
        }
        if (message.type !== "frame") return;
        message.bitmap.close();
        this.timestamp += 80;
        let f = 0;
        if (window.__fixtureMotion === "cycle") {
          const t = this.cycle % 1920;
          this.cycle += 80;
          f =
            t <= 320
              ? 0
              : t <= 640
                ? (t - 320) / 320
                : t <= 1040
                  ? 1
                  : t <= 1360
                    ? 1 - (t - 1040) / 320
                    : 0;
        } else this.cycle = 0;
        const landmarks = Array.from({ length: 33 }, () => ({
          x: 0.5,
          y: 0.5,
          visibility: 0,
          presence: 1,
        }));
        landmarks[23] = {
          x: 0.4 - 0.1 * f,
          y: 0.45 + 0.13 * f,
          visibility: 0.96,
          presence: 1,
        };
        landmarks[25] = {
          x: 0.4 + 0.08 * f,
          y: 0.65,
          visibility: 0.96,
          presence: 1,
        };
        landmarks[27] = { x: 0.4, y: 0.85, visibility: 0.96, presence: 1 };
        queueMicrotask(() => {
          if (!this.stopped)
            this.onmessage?.({
              data: {
                type: "pose",
                timestamp: this.timestamp,
                width: 480,
                height: 480,
                landmarks,
              },
            });
        });
      }
    };
  });
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
  await menu();
  await close("Adventure settings");
  await menu();
  await page
    .getByRole("button", { name: "Skills & items", exact: true })
    .click();
  await close("Inventory");
  const guide = page.getByRole("button", {
    name: "Exercise guide",
    exact: true,
  });
  if (await guide.isVisible()) {
    await guide.click();
    await close("Exercise help");
  } else
    checks.push("Exercise help control not visible in fullscreen; not claimed");
  await menu();
  const map = page.getByRole("button", { name: /^(World map|Map)$/i });
  if (await map.isVisible()) {
    await map.click();
    await close("Map");
  } else checks.push("Map modal not implemented/visible; not claimed");
  await page.screenshot({ path: "/tmp/everstride-overhaul-room.png" });
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
  await relocate("general_store", 192, 150);
  await page.getByRole("button", { name: "E · Jun", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The little supply shop", exact: true }),
  ).toBeVisible();
  await close("Shop NPC");
  await relocate("starter_town", 280, 320);
  await page.getByRole("button", { name: /E · Moss/ }).click();
  await page
    .getByRole("button", { name: "Practice with Moss", exact: true })
    .click();
  await page.locator(".command-attack").click();
  await page.getByRole("button", { name: /Earthbound/ }).click();
  const camera = page.getByRole("region", {
    name: "Exercise camera",
    exact: true,
  });
  await expect(camera).toBeVisible();
  const demo = camera.getByRole("button", {
    name: "Close exercise guide",
    exact: true,
  });
  if (await demo.isVisible()) {
    await demo.click();
    await expect(camera.locator(".exercise-guide-popover")).toHaveCount(0);
  }
  await camera.getByRole("button", { name: "Show guide", exact: true }).click();
  await camera
    .getByRole("button", { name: "Close exercise guide", exact: true })
    .click();
  await expect(camera.locator(".exercise-guide-popover")).toHaveCount(0);
  checks.push("Exercise demonstration closes with one click");
  await camera
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await expect(camera).toHaveAttribute("data-exercise-stage", "running", {
    timeout: 20000,
  });
  checks.push(
    "Starting posture starts exercise without compulsory practice repetition",
  );
  const count = camera.getByTestId("exercise-count");
  await page.evaluate(() => (window.__fixtureMotion = "cycle"));
  await expect(count).toHaveText("1", { timeout: 15000 });
  await page.evaluate(() => (window.__fixtureMotion = "ready"));
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await count.textContent();
    await camera
      .getByRole("button", { name: "Recalibrate", exact: true })
      .click();
    await expect(camera).toHaveAttribute(
      "data-exercise-stage",
      "recalibrating",
    );
    await page.waitForTimeout(4200);
    await expect(camera).toHaveAttribute(
      "data-exercise-stage",
      "recalibrating",
    );
    await expect(count).toHaveText(before);
    if (!attempt)
      await page.screenshot({
        path: "/tmp/everstride-overhaul-recalibration.png",
      });
    await expect(camera).toHaveAttribute("data-exercise-stage", "running", {
      timeout: 15000,
    });
    await expect(count).toHaveText(before);
  }
  checks.push(
    "Two recalibrations each wait five seconds and preserve verified progress",
  );
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      camera.getByRole("button", { name: "Recalibrate", exact: true }),
    ).toBeVisible();
    await expect(
      camera.getByRole("button", { name: "Voice coach", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/everstride-overhaul-camera-${width}x${height}.png`,
    });
  }
  checks.push(
    "Actual App camera screenshots at desktop and Android landscape sizes",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks,
      testLocationFixtures: ["general_store", "starter_town"],
      syntheticPose: true,
      physicalExerciseValidation: false,
      errors,
    }),
  );
} finally {
  await browser.close();
}
