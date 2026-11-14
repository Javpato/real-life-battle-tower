import {
  openCameraSettings,
  closeCameraSettings,
  dismissExerciseGuide,
} from "./browser-controls.mjs";
// Run with a Vite development server: node tests/camera-browser-smoke.mjs http://127.0.0.1:5182
// Chromium fake hardware and stream spies are test-only. This is NOT a physical exercise accuracy test.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const base = process.argv[2] || "http://127.0.0.1:5182";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__cameraStreams = [];
    window.__denyCamera = false;
    window.__delayCamera = 0;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (window.__denyCamera)
        throw new DOMException("Test permission denial", "NotAllowedError");
      const stream = await original(constraints);
      window.__cameraStreams.push(stream);
      if (window.__delayCamera)
        await new Promise((resolve) =>
          setTimeout(resolve, window.__delayCamera),
        );
      return stream;
    };
  });
  await page.goto(base + "/tests/fixtures/camera.html");
  // The standalone lifecycle fixture needs an explicit camera-stage height now that HUD overlays video.
  await page.addStyleTag({
    content: "main > .exercise-camera {height:620px;min-height:520px}",
  });
  const camera = page.getByRole("region", {
    name: "Exercise camera",
    exact: true,
  });
  const state = async (desired) =>
    await page
      .waitForFunction(
        (value) =>
          document
            .querySelector("[data-camera-state]")
            ?.getAttribute("data-camera-state") === value,
        desired,
        { timeout: 45000 },
      )
      .catch(async (error) => {
        console.error(
          "camera state failure",
          desired,
          await page.locator("body").innerText(),
          errors,
        );
        throw error;
      });
  const controls = async () => {
    await openCameraSettings(camera);
    for (const name of ["Stop camera", "Recalibrate", "Pause / rest"])
      assert(
        await page.getByRole("button", { name, exact: true }).isVisible(),
        name + " visible",
      );
    assert(await page.getByLabel("Camera facing", { exact: true }).isVisible());
    assert(await page.getByLabel("Camera device", { exact: true }).isVisible());
    const initialPosition = camera.locator(".exercise-start-position summary");
    assert(
      await initialPosition.isVisible(),
      "Starting-position disclosure remains visible",
    );
    await closeCameraSettings(camera);
  };
  await state("off");
  await dismissExerciseGuide(camera);
  await controls();
  // A denied request is recoverable without reloading, and controls remain available.
  await page.evaluate(() => {
    window.__denyCamera = true;
  });
  await page
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await state("error");
  await controls();
  assert(await page.getByText(/Camera permission was not granted/).isVisible());
  await page.evaluate(() => {
    window.__denyCamera = false;
  });
  await page.getByRole("button", { name: "Retry camera", exact: true }).click();
  await state("ready");
  await page.waitForFunction(
    () => document.querySelector("video")?.currentTime > 0,
  );
  // Stop/re-enable multiple times exercises real browser tracks and the real local recognition worker.
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Stop camera", exact: true })
      .click();
    await state("off");
    await controls();
    assert(
      await page.evaluate(
        () => document.querySelector("video").srcObject === null,
      ),
    );
    assert(
      await page.evaluate(() =>
        window.__cameraStreams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ),
    );
    await page
      .getByRole("button", { name: "Enable camera", exact: true })
      .click();
    await state("ready");
  }
  const countBefore = await page.evaluate(() => window.__cameraStreams.length);
  await page.getByRole("button", { name: "Global pause", exact: true }).click();
  await controls();
  await page.waitForTimeout(250);
  assert.equal(await page.getByTestId("units").textContent(), "0");
  await page
    .getByRole("button", { name: "Global resume", exact: true })
    .click();
  await page.getByRole("button", { name: "End turn", exact: true }).click();
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await page.getByRole("button", { name: "Begin turn", exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__cameraStreams.length),
    countBefore,
    "pause/turn/session retains camera stream",
  );
  await page.getByRole("button", { name: "Manual mode", exact: true }).click();
  await state("off");
  await controls();
  await page.getByRole("button", { name: "Camera mode", exact: true }).click();
  await state("off");
  assert(
    await page
      .getByText(/Enable the camera, then follow the starting position/)
      .isVisible(),
  );
  assert.equal(await page.getByTestId("units").textContent(), "0");
  await page.getByRole("button", { name: "Manual mode", exact: true }).click();
  await state("off");
  await page
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await state("ready");
  await page.waitForTimeout(300);
  assert.equal(
    await page.getByTestId("units").textContent(),
    "0",
    "manual camera preview does not credit units",
  );
  assert(await page.getByText(/Manual mode · preview only/).isVisible());
  await page.getByRole("button", { name: "Camera mode", exact: true }).click();
  // Facing selection restarts ownership safely. Desktop fake hardware may still report a single camera.
  await openCameraSettings(camera);
  await page
    .getByLabel("Camera facing", { exact: true })
    .selectOption("environment");
  await closeCameraSettings(camera);
  await state("ready");
  assert(
    await page.evaluate(() =>
      window.__cameraStreams
        .slice(0, -1)
        .every((s) => s.getTracks().every((t) => t.readyState === "ended")),
    ),
  );
  // Delayed permission resolution after Stop must release the newly granted stream.
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await page.evaluate(() => {
    window.__delayCamera = 700;
  });
  await page
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await state("requesting");
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await page.waitForTimeout(1000);
  await state("off");
  assert(
    await page.evaluate(() =>
      window.__cameraStreams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
  );
  await page.evaluate(() => {
    window.__delayCamera = 0;
  });
  await page
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await state("ready");
  // A late device inventory for the old stream cannot disconnect a newly restarted stream.
  await page.evaluate(() => {
    const original = navigator.mediaDevices.enumerateDevices.bind(
      navigator.mediaDevices,
    );
    window.__restoreEnumeration = () => {
      navigator.mediaDevices.enumerateDevices = original;
    };
    let calls = 0;
    navigator.mediaDevices.enumerateDevices = () =>
      ++calls === 2
        ? new Promise((resolve) => {
            window.__finishOldInventory = () => resolve([]);
          })
        : original();
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await page.waitForFunction(() => Boolean(window.__finishOldInventory));
  await page
    .getByRole("button", { name: "Restart camera", exact: true })
    .click();
  await state("ready");
  await page.evaluate(() => {
    window.__finishOldInventory();
    window.__restoreEnumeration();
  });
  await page.waitForTimeout(150);
  await state("ready");
  // Explicit start can arm a series with no recognized body, but must never create a rep.
  await page
    .getByRole("button", {
      name: "Start without automatic calibration",
      exact: true,
    })
    .click();
  assert.equal(
    await page
      .locator("[data-exercise-stage]")
      .getAttribute("data-exercise-stage"),
    "running",
  );
  await page.waitForTimeout(400);
  assert.equal(await page.getByTestId("units").textContent(), "0");
  // Landscape mobile keeps controls reachable and stop functional.
  await page.setViewportSize({ width: 844, height: 390 });
  await controls();
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await state("off");
  assert.equal(await page.getByTestId("units").textContent(), "0");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      ok: true,
      checks: [
        "permission denial and retry",
        "3 repeated stops/re-enables with real fake-hardware MediaStreams",
        "worker/model initialization on each restart",
        "pause/turn/session stream preservation",
        "manual preview without credit",
        "off-state mode change updates guidance without credit",
        "front/back restart",
        "late permission stream cleanup",
        "stale device inventory cannot stop a new stream",
        "manual arming without a detected body creates no units",
        "landscape controls",
      ],
      physicalExerciseValidation: false,
    }),
  );
} finally {
  await browser.close();
}
