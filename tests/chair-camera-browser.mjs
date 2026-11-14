/** Actual App, isolated seeded encounter and synthetic high-seat geometry.
 * This verifies UI/detector/reducer integration, not real-chair accuracy. */
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/google-chrome",
  args: [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }),
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.addInitScript(() => {
    window.__chairCycle = false;
    window.__chairOffset = 0;
    window.Worker = class {
      onmessage = null;
      closed = false;
      started = null;
      terminate() {
        this.closed = true;
      }
      postMessage(m) {
        if (m.type === "init") {
          queueMicrotask(
            () => !this.closed && this.onmessage?.({ data: { type: "ready" } }),
          );
          return;
        }
        if (m.type !== "frame") return;
        m.bitmap.close();
        if (!window.__chairCycle) this.started = null;
        else if (this.started === null) this.started = m.timestamp;
        const elapsed = this.started === null ? 0 : m.timestamp - this.started;
        const fraction =
          this.started === null
            ? 0
            : elapsed < 600
              ? elapsed / 600
              : elapsed < 1100
                ? 1
                : elapsed < 1700
                  ? 1 - (elapsed - 1100) / 600
                  : 0;
        const landmarks = Array.from({ length: 33 }, () => ({
          x: 0.5,
          y: 0.5,
          visibility: 0,
          presence: 1,
        }));
        for (const [id, x, y, standingX, standingY] of [
          [11, 0.36, 0.26, 0.5, 0.15],
          [23, 0.36, 0.51, 0.5, 0.4],
          [25, 0.5, 0.65, 0.5, 0.63],
          [27, 0.5, 0.86, 0.5, 0.86],
        ])
          landmarks[id] = {
            x: x + (standingX - x) * fraction,
            y: y + (standingY - y) * fraction + window.__chairOffset,
            visibility: 0.96,
            presence: 1,
          };
        queueMicrotask(
          () =>
            !this.closed &&
            this.onmessage?.({
              data: {
                type: "pose",
                requestId: m.requestId,
                timestamp: m.timestamp,
                width: 480,
                height: 480,
                landmarks,
              },
            }),
        );
      }
    };
  });
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173");
  await page.evaluate(async () => {
    const slots = await import("/src/services/saveSlots.ts"),
      game = await import("/src/core/game.ts");
    const slot = await slots.createSlot(1, {
        name: "Chair integration QA",
        avatar: "female",
      }),
      s = slot.snapshot;
    s.journey.introComplete = true;
    s.journey.tutorialStage = 6;
    s.player.equipped = ["sitstand"];
    s.battle = game.beginAttack(
      game.startBattle(game.enemyFor("trainer-1", s.player), s.player, null),
      game.attackFor("sitstand", s.player),
    );
    await slots.persistSlotSnapshot(slot.saveId, s);
  });
  await page.reload();
  await page.getByRole("button", { name: "PRESS ANYTHING TO START" }).click();
  await page.getByRole("button", { name: "Continue ▸", exact: true }).click();
  const camera = page.getByRole("region", {
    name: "Exercise camera",
    exact: true,
  });
  await expect(camera).toBeVisible();
  const guideClose = camera.getByRole("button", {
    name: "Close exercise guide",
    exact: true,
  });
  if (await guideClose.isVisible()) await guideClose.click();
  const resume = page.getByRole("button", { name: "Resume", exact: true });
  if (await resume.isVisible()) await resume.click();
  await camera
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await expect(camera).toHaveAttribute("data-exercise-stage", "running", {
    timeout: 18000,
  });
  await expect(camera.getByTestId("exercise-count")).toHaveText("0");
  await page.evaluate(() => (window.__chairCycle = true));
  await expect(camera.getByTestId("exercise-count")).toHaveText("1", {
    timeout: 15000,
  });
  await page.waitForTimeout(1100);
  await expect(camera.getByTestId("exercise-count")).toHaveText("1");
  const dismissal = page.getByRole("button", { name: "Dismiss tips" });
  if (await dismissal.isVisible()) await dismissal.click();
  await page.evaluate(() => {
    window.__chairCycle = false;
    window.__chairOffset = 0.08;
  });
  await camera
    .getByRole("button", { name: "Recalibrate", exact: true })
    .click();
  await expect(camera).toHaveAttribute("data-exercise-stage", "recalibrating");
  await page.waitForTimeout(4200);
  await expect(camera.getByTestId("exercise-count")).toHaveText("1");
  await expect(camera).toHaveAttribute("data-exercise-stage", "running", {
    timeout: 15000,
  });
  await page.evaluate(() => (window.__chairCycle = true));
  await expect(camera.getByTestId("exercise-count")).toHaveText("2", {
    timeout: 15000,
  });
  await page.screenshot({ path: "/tmp/everstride-chair-return-counted.png" });
  await camera.locator(".exercise-model-options summary").click();
  await expect(camera).toContainText(
    "These are camera models, not exercise difficulty levels.",
  );
  await expect(camera).toContainText("Fast (Lite) — recommended");
  await page.screenshot({
    path: "/tmp/everstride-camera-model-explanation.png",
  });
  await camera
    .getByRole("button", { name: "Close camera model options" })
    .click();
  await expect(camera.locator(".exercise-model-options")).not.toHaveAttribute(
    "open",
    "",
  );
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      passed: true,
      synthetic: true,
      physicalChairValidated: false,
      checks: [
        "135-degree seated posture starts calibration",
        "stand and return to original seat height earns exactly one unit",
        "no need to descend below seat",
        "recalibration learns a shifted camera reference and preserves the first unit",
        "static seated remainder earns no additional units",
        "plain-language camera model explanation",
      ],
      errors,
    }),
  );
} catch (error) {
  console.error(await page.locator("body").innerText());
  await page.screenshot({ path: "/tmp/everstride-chair-failure.png" });
  throw error;
} finally {
  await browser.close();
}
