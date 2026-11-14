import {
  openAttackMenu,
  openCameraControls,
  dismissExerciseGuide,
  closeModal,
  walkToFirstTrainer,
} from "./browser-controls.mjs";
/** Actual App UI. Generated camera hardware and optional synthetic landmarks are TEST ONLY.
 * GAME_URL selects Vite/preview. IMMERSIVE_WIDTHS=915,844,390 narrows viewports.
 * IMMERSIVE_PHASE=world runs exploration/menu only; =synthetic runs canonical pose flow only.
 */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
const base = process.env.GAME_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: [
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const evidence = [];
async function read(page) {
  return page.evaluate(
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
}
async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}
async function enterGame(page) {
  await page.goto(base);
  await page
    .getByRole("button", { name: "Take the first step", exact: true })
    .click();
  await expect(page.locator(".immersive-game.mode-explore")).toBeVisible();
  await expect(page.locator(".world-frame canvas")).toHaveCount(1);
  await page.waitForTimeout(400);
}
async function enterTrainer(page) {
  await walkToFirstTrainer(page);
  await page.getByLabel("Use camera verification").check();
  await page
    .getByRole("button", { name: "Begin encounter", exact: true })
    .click();
  await expect(page.locator(".immersive-game.mode-battle")).toBeVisible();
}
async function visibleBox(locator) {
  await expect(locator).toBeVisible();
  return locator.evaluate((element) => {
    const r = element.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      font: parseFloat(getComputedStyle(element).fontSize),
      inViewport:
        r.x >= -1 &&
        r.y >= -1 &&
        r.right <= innerWidth + 1 &&
        r.bottom <= innerHeight + 1,
    };
  });
}
async function reachable(locator) {
  const box = await visibleBox(locator);
  assert(box.inViewport, "control fully visible in viewport");
  assert(
    await locator.evaluate((element) => {
      const r = element.getBoundingClientRect(),
        hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit === element || element.contains(hit);
    }),
    "control center not occluded by another overlay",
  );
  return box;
}
async function screenshot(page, name) {
  await page.evaluate(() => {
    if (
      !window.__syntheticPose &&
      !document.querySelector(".exercise-feed.is-live")
    )
      return;
    const tag = document.createElement("div");
    tag.id = "qa-capture-label";
    tag.textContent = window.__syntheticPose
      ? "QA · SYNTHETIC LANDMARKS · NOT A PHYSICAL TEST"
      : "QA · GENERATED CAMERA · NOT A PHYSICAL TEST";
    tag.style.cssText =
      "position:fixed;top:0;left:50%;transform:translateX(-50%);font:700 10px system-ui;background:#fff5ce;color:#402b0d;padding:3px 8px;z-index:2147483647;pointer-events:none";
    document.body.append(tag);
  });
  await page.screenshot({ path: `/tmp/everstride-immersive-${name}.png` });
  await page.evaluate(() =>
    document.getElementById("qa-capture-label")?.remove(),
  );
}
async function activeCamera(page, attack) {
  await openAttackMenu(page);
  await page.getByRole("button", { name: attack }).click();
  const camera = page.locator(".exercise-camera");
  await expect(camera).toBeVisible();
  if (
    await camera
      .getByRole("button", { name: "Close exercise guide", exact: true })
      .isVisible()
  )
    await screenshot(page, `guide-${page.viewportSize().width}`);
  await dismissExerciseGuide(camera);
  await screenshot(page, `preparation-${page.viewportSize().width}`);
  await page.evaluate(() => {
    window.__cameraNode = document.querySelector(".exercise-camera");
  });
  await camera
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await expect(camera).toHaveAttribute("data-camera-state", "ready", {
    timeout: 45000,
  });
  return camera;
}
async function sameCamera(page) {
  assert(
    await page.evaluate(
      () => document.querySelector(".exercise-camera") === window.__cameraNode,
    ),
    "camera remains mounted",
  );
}
async function installSyntheticWorker(page) {
  await page.addInitScript(() => {
    window.__syntheticPose = true;
    window.__testMotion = "ready";
    window.Worker = class TestWorker {
      onmessage = null;
      onerror = null;
      onmessageerror = null;
      stopped = false;
      timestamp = 0;
      cycleTime = 0;
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
        let factor = 0;
        if (window.__testMotion === "cycle") {
          const t = this.cycleTime % 1920;
          this.cycleTime += 80;
          factor =
            t <= 320
              ? 0
              : t <= 640
                ? (t - 320) / 320
                : t <= 1040
                  ? 1
                  : t <= 1360
                    ? 1 - (t - 1040) / 320
                    : 0;
        } else this.cycleTime = 0;
        const landmarks = Array.from({ length: 33 }, () => ({
          x: 0.5,
          y: 0.5,
          visibility: 0,
          presence: 1,
        }));
        landmarks[23] = {
          x: 0.4 - 0.1 * factor,
          y: 0.45 + 0.13 * factor,
          visibility: 0.96,
          presence: 1,
        };
        landmarks[25] = {
          x: 0.4 + 0.08 * factor,
          y: 0.65,
          visibility: 0.96,
          presence: 1,
        };
        landmarks[27] = { x: 0.4, y: 0.85, visibility: 0.96, presence: 1 };
        if (window.__testMotion === "missing")
          landmarks.forEach((point) => {
            point.visibility = 0;
          });
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
}
try {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 915, height: 412 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ].filter(
    (viewport) =>
      process.env.IMMERSIVE_PHASE !== "synthetic" &&
      (!process.env.IMMERSIVE_WIDTHS ||
        process.env.IMMERSIVE_WIDTHS.split(",").includes(
          String(viewport.width),
        )),
  )) {
    const page = await browser.newPage({ viewport }),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await enterGame(page);
      const world = await visibleBox(page.locator(".world-frame canvas"));
      const shell = await visibleBox(page.locator(".immersive-game"));
      assert(
        world.width >= viewport.width - 2 &&
          world.height >= viewport.height - 2,
        "world canvas fills viewport",
      );
      assert(
        shell.width >= viewport.width - 2 &&
          shell.height >= viewport.height - 2,
        "immersive shell fills viewport",
      );
      await screenshot(page, `world-${viewport.width}`);
      const fullscreen = page.getByRole("button", {
        name: "Enter fullscreen",
        exact: true,
      });
      await reachable(fullscreen);
      await fullscreen.click();
      await page.waitForFunction(() => Boolean(document.fullscreenElement));
      await page
        .getByRole("button", { name: "Exit fullscreen", exact: true })
        .click();
      await page.waitForFunction(() => !document.fullscreenElement);
      await page.setViewportSize(viewport);
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await expect(page.getByLabel("Adventure difficulty")).toBeVisible();
      await reachable(page.getByRole("button", { name: /^Close(?: modal)?$/ }));
      await screenshot(page, `menu-${viewport.width}`);
      await closeModal(page);
      await enterTrainer(page);
      await screenshot(page, `battle-${viewport.width}`);
      await openAttackMenu(page);
      for (const attack of [
        /Earthbound/,
        /Iron Pulse/,
        /Skykeeper/,
        /Wild Balance/,
      ])
        await reachable(page.getByRole("button", { name: attack }));
      await screenshot(page, `attack-menu-${viewport.width}`);
      if (process.env.IMMERSIVE_PHASE === "world") {
        evidence.push({ viewport, world, shell, errors });
        continue;
      }
      const camera = await activeCamera(page, /Wild Balance/);
      const before = await read(page);
      const inset = {};
      for (const [name, selector] of Object.entries({
        enemyHP: ".enemy-plate",
        heroHP: ".hero-plate",
        enemy: ".combat-sprite.enemy",
        hero: ".combat-sprite.hero",
      })) {
        if (
          name === "hero" &&
          ((viewport.width > viewport.height && viewport.height <= 600) ||
            viewport.width <= 600)
        ) {
          await expect(page.locator(selector)).toBeHidden();
          inset.hero = { hiddenForCompactInset: true };
          continue;
        }
        inset[name] = await visibleBox(page.locator(selector));
        assert(
          inset[name].width > 0 && inset[name].height > 0,
          `${name} has actual visible dimensions`,
        );
        assert(inset[name].inViewport, `${name} remains inside viewport`);
      }
      await expect(camera.locator(".exercise-next-side")).toBeVisible();
      const number = await visibleBox(camera.getByTestId("exercise-count"));
      const side = await visibleBox(camera.locator(".exercise-next-side"));
      const cue = await camera
        .locator(".exercise-next-side strong")
        .evaluate((element) => {
          const r = element.getBoundingClientRect(),
            parent = element.parentElement.getBoundingClientRect();
          return {
            width: element.clientWidth,
            scrollWidth: element.scrollWidth,
            inside: r.x >= parent.x - 1 && r.right <= parent.right + 1,
          };
        });
      assert(
        cue.inside && (!cue.width || cue.scrollWidth <= cue.width + 1),
        "anatomical next-side value is not clipped",
      );
      const feedback = await visibleBox(
        camera.locator(".exercise-big-feedback"),
      );
      assert(
        number.inViewport && side.inViewport && feedback.inViewport,
        "counter, side cue and feedback remain on screen",
      );
      assert(
        number.font >=
          (viewport.width > 1000 ? 110 : viewport.width > 600 ? 80 : 72),
        "counter remains readable from exercise distance",
      );
      await reachable(page.getByRole("button", { name: "Rest", exact: true }));
      if (viewport.width > viewport.height)
        assert(
          await page.evaluate(
            () =>
              document.documentElement.scrollHeight <= innerHeight + 2 &&
              document.documentElement.scrollWidth <= innerWidth + 2,
          ),
          "landscape game does not scroll",
        );
      await screenshot(page, `camera-${viewport.width}`);
      await camera
        .getByRole("button", {
          name: "Start without automatic calibration",
          exact: true,
        })
        .click();
      await expect(camera).toHaveAttribute("data-exercise-stage", "running");
      await page.waitForTimeout(500);
      assert.equal((await read(page)).battle.progress, 0);
      assert.equal((await read(page)).battle.enemyHp, before.battle.enemyHp);
      await page.getByRole("button", { name: "Rest", exact: true }).click();
      await screenshot(page, `pause-${viewport.width}`);
      await sameCamera(page);
      await expect(camera).toHaveAttribute("data-camera-state", "ready");
      await reachable(
        camera.getByRole("button", { name: "Stop camera", exact: true }),
      );
      await camera
        .getByRole("button", { name: "Stop camera", exact: true })
        .click();
      await expect(camera).toHaveAttribute("data-camera-state", "off");
      await camera
        .getByRole("button", { name: "Enable camera", exact: true })
        .click();
      await expect(camera).toHaveAttribute("data-camera-state", "ready", {
        timeout: 45000,
      });
      await sameCamera(page);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await camera
        .getByRole("button", { name: "Recalibrate", exact: true })
        .click();
      assert.equal((await read(page)).battle.progress, 0);
      await page
        .getByRole("button", {
          name: "Detection trouble? Continue remaining units manually",
          exact: true,
        })
        .click();
      await expect(camera).toHaveAttribute("data-camera-state", "off");
      await sameCamera(page);
      await page
        .getByRole("button", {
          name: "I completed the remaining units",
          exact: true,
        })
        .click();
      await expect
        .poll(async () => (await read(page)).battle.enemyHp)
        .toBeLessThan(before.battle.enemyHp);
      assert.equal((await read(page)).battle.verified, 0);
      await screenshot(page, `victory-or-turn-${viewport.width}`);
      assert.deepEqual(errors, []);
      evidence.push({
        viewport,
        world,
        shell,
        number,
        side,
        feedback,
        inset,
        errors,
      });
      console.log(JSON.stringify({ viewport, phase: "camera-complete" }));
    } catch (error) {
      await screenshot(page, `failure-${viewport.width}`);
      console.error(await page.locator("body").innerText());
      throw error;
    } finally {
      await page.close();
    }
  }
  if (process.env.IMMERSIVE_PHASE !== "world") {
    // A synthetic full squat enters through the production camera→detector→command path.
    // Preserve its canonical damage through pause/restart and explicit manual continuation.
    const page = await browser.newPage({
        viewport: { width: 844, height: 390 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await installSyntheticWorker(page);
    try {
      await enterGame(page);
      await enterTrainer(page);
      const camera = await activeCamera(page, /Earthbound/),
        initial = await read(page);
      await camera
        .getByRole("button", {
          name: "Start without automatic calibration",
          exact: true,
        })
        .click();
      await page.evaluate(() => {
        window.__testMotion = "cycle";
      });
      await expect
        .poll(async () => (await read(page)).battle.progress, {
          timeout: 15000,
        })
        .toBe(1);
      await page.evaluate(() => {
        window.__testMotion = "ready";
      });
      const partial = await read(page);
      assert(partial.battle.enemyHp < initial.battle.enemyHp);
      assert.equal(partial.battle.verified, 1);
      await screenshot(page, "synthetic-repetition");
      await page.evaluate(() => {
        window.__testMotion = "missing";
      });
      await page.waitForTimeout(500);
      assert.equal((await read(page)).battle.progress, 1);
      assert.equal((await read(page)).battle.enemyHp, partial.battle.enemyHp);
      await screenshot(page, "synthetic-tracking-loss");
      await page.evaluate(() => {
        window.__testMotion = "ready";
      });
      await page.getByRole("button", { name: "Rest", exact: true }).click();
      await camera
        .getByRole("button", { name: "Stop camera", exact: true })
        .click();
      await camera
        .getByRole("button", { name: "Enable camera", exact: true })
        .click();
      await expect(camera).toHaveAttribute("data-camera-state", "ready");
      await sameCamera(page);
      await page.waitForTimeout(400);
      assert.equal((await read(page)).battle.enemyHp, partial.battle.enemyHp);
      assert.equal((await read(page)).battle.progress, 1);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await camera
        .getByRole("button", { name: "Recalibrate", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Detection trouble? Continue remaining units manually",
          exact: true,
        })
        .click();
      assert.equal((await read(page)).battle.progress, 1);
      assert.equal((await read(page)).battle.enemyHp, partial.battle.enemyHp);
      await page
        .getByRole("button", {
          name: "I completed the remaining units",
          exact: true,
        })
        .click();
      await expect
        .poll(async () => (await read(page)).battle.enemyHp)
        .toBeLessThan(partial.battle.enemyHp);
      const completed = (await read(page)).battle;
      assert.equal(completed.verified, 1);
      assert(completed.unverified > 0);
      assert.deepEqual(errors, []);
      evidence.push({
        syntheticPartialDamagePreserved: true,
        verified: completed.verified,
        unverified: completed.unverified,
      });
    } catch (error) {
      await screenshot(page, "synthetic-failure");
      throw error;
    } finally {
      await page.close();
    }
  }
  console.log(
    JSON.stringify({
      passed: true,
      evidence,
      physicalExerciseValidation: false,
    }),
  );
} finally {
  await browser.close();
}
