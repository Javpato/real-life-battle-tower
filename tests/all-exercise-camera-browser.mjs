/** Integration with synthetic phone landmarks, not physical exercise validation. */
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const base = process.env.GAME_URL || "http://127.0.0.1:5186";
const out = process.env.QA_DIR || "/tmp/all-exercise-camera-qa";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/google-chrome",
  args: [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.waitForTimeout(1900);
  await page
    .getByRole("button", { name: "PRESS ANYTHING TO START", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore a local preview", exact: true })
    .click();
  await page.getByRole("button", { name: /Custom Workout Build/ }).click();
  await expect(page.locator(".bt-training-card")).toHaveCount(90);
  await page.getByText("Filter exercises", { exact: true }).click();
  for (const [method, count] of [
    ["camera", 70],
    ["assisted", 60],
    ["manual", 20],
    ["all", 90],
  ]) {
    await page.getByLabel("Recognition", { exact: true }).selectOption(method);
    await expect(page.locator(".bt-training-card")).toHaveCount(count);
  }
  await page.getByText("Filter exercises", { exact: true }).click();
  // Only a requested lesson mounts its animation.
  await expect(page.locator(".bt-training-learn .exercise-demo")).toHaveCount(
    0,
  );
  const card = page.locator(".bt-training-card").filter({
    has: page.getByRole("heading", { name: "Sumo Squat", exact: true }),
  });
  await card
    .getByRole("button", { name: "Visual learn · Sumo Squat", exact: true })
    .click();
  await expect(card.locator(".exercise-demo")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".bt-learning-dialog")).toHaveCount(0);
  await card
    .getByRole("button", { name: "Visual learn · Sumo Squat", exact: true })
    .click();
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1280, 720],
    [915, 412],
    [800, 360],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("button", { name: "Close visual guide" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(height);
    await page.screenshot({
      path: `${out}/visual-learn-${width}x${height}.png`,
    });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole("button", { name: "Close visual guide" }).click();
  await card.getByRole("button", { name: "Train now", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Assisted camera", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".exercise-camera")).toHaveAttribute(
    "data-skill-id",
    "sumo-squat",
  );
  await expect(page.locator(".exercise-counter-target")).toContainText(
    "REPETITIONS",
  );
  const close = page.getByRole("button", { name: "Close exercise guide" });
  if (await close.isVisible()) await close.click();
  await page
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await expect
    .poll(
      () => page.locator(".exercise-feed video").evaluate((v) => v.readyState),
      { timeout: 30000 },
    )
    .toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("exercise-count")).toHaveText("0");
  await page.screenshot({ path: `${out}/assisted-camera-live-model.png` });
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  // Production camera component, exact skill binding and synthetic peer frames.
  await page.goto(`${base}/tests/fixtures/camera.html?skill=sumo-squat`);
  if (
    await page.getByRole("button", { name: "Close exercise guide" }).isVisible()
  )
    await page.getByRole("button", { name: "Close exercise guide" }).click();
  await page.getByRole("button", { name: "Phone source", exact: true }).click();
  await page
    .getByRole("button", { name: "Start without automatic calibration" })
    .click();
  async function pose(kind, duration) {
    await page.evaluate(
      async ({ kind, duration }) => {
        const until = performance.now() + duration;
        while (performance.now() < until) {
          const points = Array.from({ length: 33 }, () => ({
            x: 0.5,
            y: 0.5,
            visibility: 0,
            presence: 1,
          }));
          for (let side = 0; side < 2; side++) {
            const mirror = (x) => (side ? 1 - x : x);
            const values =
              kind === "bend"
                ? [
                    [11, 0.4, 0.32],
                    [23, 0.4, 0.55],
                    [25, 0.27, 0.68],
                    [27, 0.27, 0.88],
                  ]
                : [
                    [11, 0.4, 0.2],
                    [23, 0.4, 0.43],
                    [25, 0.34, 0.65],
                    [27, 0.28, 0.88],
                  ];
            for (const [id, x, y] of values)
              points[id + side] = {
                x: mirror(x),
                y,
                visibility: 0.99,
                presence: 1,
              };
          }
          window.dispatchEvent(
            new CustomEvent("test-phone-frame", {
              detail:
                kind === "lost"
                  ? null
                  : {
                      timestamp: performance.now(),
                      width: 480,
                      height: 480,
                      landmarks: points,
                    },
            }),
          );
          await new Promise((r) => setTimeout(r, 55));
        }
      },
      { kind, duration },
    );
  }
  await pose("start", 1500);
  await expect(page.getByTestId("units")).toHaveText("0");
  await pose("bend", 1300);
  await pose("start", 1300);
  await expect(page.getByTestId("units")).toHaveText("1");
  const event = JSON.parse(await page.getByTestId("events").textContent())[0];
  expect(event).toMatchObject({
    skillId: "sumo-squat",
    profileId: "assisted-v1:sumo-squat",
    evidence: "assisted",
    verified: false,
  });
  expect(event.cycle).toBeUndefined();
  await expect(page.locator(".exercise-hud-heading")).toContainText("ASSISTED");
  expect(await page.locator(".exercise-hud").innerText()).not.toMatch(
    /100% QUALITY/,
  );
  await page.getByRole("button", { name: "Global pause", exact: true }).click();
  await pose("bend", 650);
  await pose("start", 650);
  await expect(page.getByTestId("units")).toHaveText("1");
  await page
    .getByRole("button", { name: "Global resume", exact: true })
    .click();
  await pose("lost", 200);
  await expect(page.getByTestId("units")).toHaveText("1");
  await page.screenshot({ path: `${out}/assisted-peer-evidence.png` });
  // A second skill with the same transport family must not inherit the wrong unit.
  await page.goto(`${base}/tests/fixtures/camera.html?skill=high-plank`);
  if (
    await page.getByRole("button", { name: "Close exercise guide" }).isVisible()
  )
    await page.getByRole("button", { name: "Close exercise guide" }).click();
  await expect(page.locator(".exercise-counter-target")).toContainText(
    "SECONDS",
  );
  await page.goto(`${base}/tests/fixtures/camera.html?skill=back-extension`);
  if (
    await page.getByRole("button", { name: "Close exercise guide" }).isVisible()
  )
    await page.getByRole("button", { name: "Close exercise guide" }).click();
  await expect(page.locator(".exercise-counter-target")).toContainText(
    "REPETITIONS",
  );
  // Camera resumes on the anatomical side advanced by manual input.
  await page.goto(`${base}/tests/fixtures/camera.html?skill=assisted-lunge`);
  if (
    await page.getByRole("button", { name: "Close exercise guide" }).isVisible()
  )
    await page.getByRole("button", { name: "Close exercise guide" }).click();
  await page.getByRole("button", { name: "Manual mode", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm manual fixture unit", exact: true })
    .click();
  await page.getByRole("button", { name: "Camera mode", exact: true }).click();
  await expect(page.locator(".exercise-next-side strong")).toHaveText(
    "RIGHT SIDE",
  );
  // Confirmation-only preview cannot turn arbitrary movement into automatic units.
  await page.goto(`${base}/tests/fixtures/camera.html?skill=cat-cow`);
  if (
    await page.getByRole("button", { name: "Close exercise guide" }).isVisible()
  )
    await page.getByRole("button", { name: "Close exercise guide" }).click();
  await page.getByRole("button", { name: "Phone source", exact: true }).click();
  await pose("start", 700);
  await pose("bend", 700);
  await pose("start", 700);
  await expect(page.getByTestId("units")).toHaveText("0");
  await expect(page.locator(".exercise-camera")).toHaveAttribute(
    "data-recognition-method",
    "confirmation",
  );
  await page.screenshot({ path: `${out}/confirmation-preview.png` });
  expect(errors).toEqual([]);
  const report = {
    passed: true,
    physicalValidation: false,
    checks: [
      "90 exercise library",
      "lazy visual lessons with Escape and visible close control",
      "70 automatic profiles / 60 assisted / 20 confirmation filters",
      "five viewport bounds",
      "real Lite model with synthetic blank camera",
      "exact assisted skill on synthetic phone frames",
      "no idle or paused credit",
      "unverified metadata and no fabricated quality",
      "skill-specific reps/seconds",
      "confirmation preview no automatic units",
      "manual-to-camera anatomical side retained",
    ],
    errors,
  };
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
