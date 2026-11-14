import {
  walkToFirstTrainer,
  openAttackMenu,
  openCameraControls,
  dismissExerciseGuide,
} from "./browser-controls.mjs";
/** Real App UI using Chromium's generated camera stream. No physical recognition claim. */
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: [
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};
const read = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("everstride");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            r = db
              .transaction("state", "readonly")
              .objectStore("state")
              .get("adventure");
          r.onsuccess = () => {
            resolve(r.result);
            db.close();
          };
          r.onerror = () => reject(r.error);
        };
      }),
  );
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Take the first step" }).click();
  await expect(page.locator(".world-frame canvas")).toHaveCount(1);
  await page.waitForTimeout(400);
  await walkToFirstTrainer(page);
  await page.getByLabel("Use camera verification").check();
  await page.getByRole("button", { name: "Begin encounter" }).click();
  await openCameraControls(page);
  const camera = page.locator(".exercise-camera");
  await dismissExerciseGuide(camera);
  await expect(camera).toBeVisible();
  await page.evaluate(() => {
    window.__cameraRoot = document.querySelector(".exercise-camera");
  });
  const same = async () =>
    expect(
      await page.evaluate(
        () =>
          document.querySelector(".exercise-camera") === window.__cameraRoot,
      ),
    ).toBe(true);
  await openCameraControls(page);
  await camera
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await expect(camera).toHaveAttribute("data-camera-state", "ready", {
    timeout: 30000,
  });
  await openAttackMenu(page);
  await page.getByRole("button", { name: /Earthbound/ }).click();
  await expect(
    page
      .locator(".exercise-mode-switch button")
      .filter({ hasText: "Manual mode" }),
  ).toBeDisabled();
  await expect(
    page
      .locator(".exercise-mode-switch button")
      .filter({ hasText: "Camera mode" }),
  ).toBeDisabled();
  await same();
  const layoutEvidence = [];
  for (const viewport of [
    { width: 1440, height: 1050 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await camera.evaluate((element) =>
      element.scrollIntoView({ block: "start" }),
    );
    await page.waitForTimeout(200);
    const metrics = await camera.evaluate((element) => {
      const rect = (selector) => {
        const e = element.querySelector(selector),
          r = e.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          fontSize: getComputedStyle(e).fontSize,
        };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        counter: rect(".exercise-counter"),
        number: rect("[data-testid=exercise-count]"),
        feed: rect(".exercise-feed"),
        hud: rect(".exercise-hud"),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    layoutEvidence.push(metrics);
    await page.screenshot({
      path: `/tmp/everstride-camera-app-${viewport.width}.png`,
    });
    await camera
      .getByRole("button", { name: "Stop camera", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      camera.getByRole("button", { name: "Stop camera", exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: `/tmp/everstride-camera-app-controls-${viewport.width}.png`,
    });
  }
  console.log(JSON.stringify({ layoutEvidence }));
  await page.setViewportSize({ width: 1440, height: 1050 });
  const before = await read();
  await page.waitForTimeout(800);
  expect((await read()).battle.progress).toBe(0);
  expect((await read()).battle.enemyHp).toBe(before.battle.enemyHp);
  await page.getByRole("button", { name: "Rest", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await same();
  await expect(camera).toHaveAttribute("data-camera-state", "ready");
  await expect(
    camera.getByRole("button", { name: "Stop camera", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await camera
    .getByRole("button", { name: "Stop camera", exact: true })
    .click();
  await expect(camera).toHaveAttribute("data-camera-state", "off");
  await same();
  await openCameraControls(page);
  await camera
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await expect(camera).toHaveAttribute("data-camera-state", "ready", {
    timeout: 30000,
  });
  await page
    .getByRole("button", {
      name: "Detection trouble? Continue remaining units manually",
      exact: true,
    })
    .click();
  await expect(camera).toHaveAttribute("data-camera-state", "off");
  await same();
  await openCameraControls(page);
  await camera
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await expect(camera).toHaveAttribute("data-camera-state", "ready", {
    timeout: 30000,
  });
  await page.waitForTimeout(800);
  expect((await read()).battle.progress).toBe(0);
  expect((await read()).battle.enemyHp).toBe(before.battle.enemyHp);
  await page
    .getByRole("button", {
      name: "I completed the remaining units",
      exact: true,
    })
    .click();
  const victory = page.getByRole("heading", { name: "A well-earned victory." });
  await expect
    .poll(
      async () =>
        (await victory.isVisible()) ||
        (await page.locator(".command-attack").isVisible()),
    )
    .toBe(true);
  await same();
  for (let n = 0; n < 10 && !(await victory.isVisible()); n++) {
    await openAttackMenu(page);
    await page.getByRole("button", { name: /Earthbound/ }).click();
    await page
      .getByRole("button", {
        name: "I completed the remaining units",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await victory.isVisible()) ||
          (await page.locator(".command-attack").isVisible()),
      )
      .toBe(true);
  }
  await expect(victory).toBeVisible();
  await same();
  const won = await read();
  await page.waitForTimeout(500);
  expect((await read()).battle).toEqual(won.battle);
  expect(won.battle.verified).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "/tmp/everstride-camera-app-victory.png",
    fullPage: true,
  });
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "real App navigation",
        "persistent camera through pause/off/restart/manual/turns/victory",
        "mode locked during series",
        "generated blank camera never changes canonical HP",
        "manual fallback explicit",
        "early victory ignores later frames",
      ],
      physicalExerciseValidation: false,
      errors,
    }),
  );
} catch (e) {
  await page.screenshot({
    path: "/tmp/everstride-camera-app-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
