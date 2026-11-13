// Run against Vite: node tests/camera-receipts-browser.mjs http://127.0.0.1:5182
// Synthetic landmarks replace ONLY the browser test's worker. This tests integration, not physical accuracy.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__testMotion = "ready";
    window.Worker = class SyntheticPoseWorker {
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
  await page.goto(
    (process.argv[2] || "http://127.0.0.1:5182") +
      "/tests/fixtures/camera.html?receipts",
  );
  await page
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  // Starting posture alone must calibrate, count down and run. No compulsory practice rep.
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-exercise-stage]")
        ?.getAttribute("data-exercise-stage") === "running",
  );
  assert.equal(await page.getByTestId("units").textContent(), "0");
  assert.equal(await page.getByTestId("requests").textContent(), "0");
  await page.evaluate(() => {
    window.__testMotion = "cycle";
  });
  const requested = async (n) =>
    await page.waitForFunction(
      (n) =>
        document.querySelector("[data-testid=requests]")?.textContent ===
        String(n),
      n,
    );
  await requested(1);
  await page.waitForTimeout(2200);
  assert.equal(
    await page.getByTestId("requests").textContent(),
    "1",
    "one unacknowledged unit at a time",
  );
  assert.equal(
    await page.getByTestId("units").textContent(),
    "0",
    "HUD uses only canonical progress",
  );
  assert(await page.getByText(/Saving this repetition/).isVisible());
  await page.getByRole("button", { name: "Reject repetition" }).click();
  await requested(2);
  await page.getByRole("button", { name: "Reject repetition" }).click();
  await requested(3);
  assert.equal(
    await page.getByTestId("units").textContent(),
    "0",
    "two rejected reps cannot exhaust a target of two",
  );
  await page.getByRole("button", { name: "Accept repetition" }).click();
  await page.waitForFunction(
    () => document.querySelector("[data-testid=units]")?.textContent === "1",
  );
  await page.getByRole("button", { name: "Global pause", exact: true }).click();
  const before = await page.getByTestId("requests").textContent();
  await page.waitForTimeout(2200);
  assert.equal(
    await page.getByTestId("requests").textContent(),
    before,
    "paused frames do not submit units",
  );
  await page.evaluate(() => {
    window.__testMotion = "ready";
  });
  await page
    .getByRole("button", { name: "Global resume", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-exercise-stage]")
        ?.getAttribute("data-exercise-stage") === "countdown",
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-exercise-stage]")
        ?.getAttribute("data-exercise-stage") === "running",
  );
  await page.evaluate(() => {
    window.__testMotion = "cycle";
  });
  await requested(4);
  await page.getByRole("button", { name: "Accept repetition" }).click();
  await page.waitForFunction(
    () => document.querySelector("[data-testid=units]")?.textContent === "2",
  );
  await page.waitForTimeout(2200);
  assert.equal(
    await page.getByTestId("requests").textContent(),
    "4",
    "canonical completed target immediately stops further units",
  );
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      ok: true,
      checks: [
        "700ms posture plus countdown without practice rep",
        "one pending canonical receipt",
        "HUD not optimistic",
        "rejections preserve remaining unit budget",
        "pause blocks synthetic reps",
        "target completion stops recognition",
      ],
      physicalExerciseValidation: false,
    }),
  );
} finally {
  await browser.close();
}
