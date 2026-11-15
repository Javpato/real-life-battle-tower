/** Published UI/model check with a synthetic blank camera; no player saves accessed. */
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
  expect(errors).toEqual([]);
  const report = {
    passed: true,
    hostedUrl: base,
    physicalValidation: false,
    checks: [
      "90 exercises",
      "70 automatic / 60 assisted / 20 preview filters",
      "responsive visual learning and Escape",
      "live MediaPipe with synthetic blank camera",
      "no false units",
    ],
    errors,
  };
  await fs.writeFile(
    `${out}/public-report.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
