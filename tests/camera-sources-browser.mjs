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
    window.__captures = 0;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = (...args) => {
      window.__captures++;
      return original(...args);
    };
    window.Worker = class {
      onmessage = null;
      terminate() {}
      postMessage(m) {
        if (m.type === "init")
          queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } }));
        if (m.type === "frame") m.bitmap.close();
      }
    };
  });
  await page.goto(
    (process.argv[2] || "http://127.0.0.1:5188") +
      "/tests/fixtures/camera.html",
  );
  await page.getByRole("button", { name: "Close exercise guide" }).click();
  await page.getByRole("button", { name: "Manual mode", exact: true }).click();
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await page
    .getByRole("button", { name: "Manual mode", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => window.__captures),
    1,
    "primary Enable leaves manual mode",
  );
  await page.getByRole("button", { name: "Phone source", exact: true }).click();
  assert.equal(
    await page.locator("video").evaluate((v) => v.srcObject),
    null,
    "phone releases local preview",
  );
  const send = async (kind = "fresh") =>
    page.evaluate((kind) => {
      const p = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        visibility: 0,
        presence: 1,
      }));
      for (const [i, y] of [
        [23, 0.4],
        [25, 0.6],
        [27, 0.8],
      ])
        p[i] = { x: 0.4, y, visibility: 0.95, presence: 1 };
      const frame = {
        timestamp: performance.now() - (kind === "stale" ? 1000 : 0),
        width: 480,
        height: 480,
        landmarks: p,
      };
      window.dispatchEvent(
        new CustomEvent("test-phone-frame", {
          detail: kind === "lost" ? null : frame,
        }),
      );
    }, kind);
  for (let i = 0; i < 12; i++) {
    await send();
    await page.waitForTimeout(90);
  }
  assert.equal(
    await page.evaluate(() => window.__captures),
    1,
    "phone frames never acquire a second local camera",
  );
  await send("stale");
  await page.waitForTimeout(120);
  assert.match(
    await page.locator(".exercise-camera").innerText(),
    /Phone tracking paused|Waiting for fresh phone/,
  );
  assert.equal(await page.getByTestId("units").innerText(), "0");
  await send("lost");
  await page.waitForTimeout(120);
  assert.equal(await page.getByTestId("units").innerText(), "0");
  await page
    .getByRole("button", { name: "Webcam source", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => window.__captures),
    1,
    "switching back requires explicit local enable",
  );
  let downloads = 0;
  await page.route(
    "https://storage.googleapis.com/mediapipe-models/**",
    (route) => {
      downloads++;
      return route.fulfill({
        status: 200,
        contentType: "application/octet-stream",
        body: "synthetic-model-only-for-control-test",
      });
    },
  );
  await page.getByText("Recognition model · Lite", { exact: true }).click();
  await page
    .getByRole("button", { name: "Download and use Full", exact: true })
    .click();
  await page.getByText("Recognition model · Full", { exact: true }).waitFor();
  assert.equal(downloads, 1);
  assert.equal(
    await page.evaluate(() => window.__captures),
    1,
    "model download does not start capture",
  );
  await page.getByRole("button", { name: "Use Lite", exact: true }).click();
  await page.getByRole("button", { name: "Use Full", exact: true }).click();
  assert.equal(downloads, 1, "already downloaded model is reused");
  assert.deepEqual(errors, []);
  console.log(
    "PASS primary manual-to-camera action, phone track release, stale/lost evidence, explicit webcam restart. Synthetic transport; no physical accuracy claim.",
  );
} finally {
  await browser.close();
}
