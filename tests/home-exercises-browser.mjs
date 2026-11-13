/** Real UI actions in fresh contexts. Manual confirmations are explicitly unverified. */
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const exercises = [
  {
    id: "sitstand",
    name: "Root Rise",
    title: "Chair sit-to-stand",
    setup: /Sit near the front/,
  },
  {
    id: "wallpushup",
    name: "Wall Pulse",
    title: "Wall push-up",
    setup: /Face a clear wall/,
  },
  {
    id: "bridge",
    name: "Meadow Bridge",
    title: "Glute bridge",
    setup: /Lie on your back/,
  },
];
const results = [];
try {
  for (const exercise of exercises) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1050 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const read = () =>
      page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const q = indexedDB.open("everstride");
            q.onerror = () => reject(q.error);
            q.onsuccess = () => {
              const db = q.result,
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
    const hold = async (key, ms) => {
      await page.keyboard.down(key);
      await page.waitForTimeout(ms);
      await page.keyboard.up(key);
    };
    try {
      await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173");
      await page.getByRole("button", { name: "Take the first step" }).click();
      await expect(page.locator(".world-frame canvas")).toHaveCount(1);
      await page
        .getByRole("button", { name: "Exercise guide", exact: true })
        .click();
      const library = page.locator(".exercise-library");
      await library
        .getByRole("button", { name: new RegExp(exercise.title) })
        .click();
      await expect(library.getByText(exercise.setup)).toBeVisible();
      await expect(
        library.getByText(exercise.name + " · " + exercise.title, {
          exact: true,
        }),
      ).toBeVisible();
      await page.screenshot({
        path: `/tmp/everstride-home-${exercise.id}-guide.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page
        .getByRole("button", { name: "Satchel & skills", exact: true })
        .click();
      const modal = page.locator(".modal");
      for (const name of ["Earthbound", "Iron Pulse", "Skykeeper"]) {
        const card = modal.getByRole("button", { name: new RegExp(name) });
        await card.click();
        await expect(card).not.toHaveClass(/equipped/);
      }
      for (const item of exercises) {
        const card = modal.getByRole("button", { name: new RegExp(item.name) });
        await card.click();
        await expect(card).toHaveClass(/equipped/);
      }
      await expect
        .poll(async () => (await read()).player.equipped.join(","))
        .toBe("birddog,sitstand,wallpushup,bridge");
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.waitForTimeout(400);
      await hold("d", 550);
      const trainer = page.getByRole("button", {
        name: /E · .* · first steps/,
      });
      for (let i = 0; i < 8 && !(await trainer.isVisible()); i++)
        await hold("s", 140);
      await expect(trainer).toBeVisible();
      await page.keyboard.press("e", { delay: 150 });
      await page.getByLabel("Use camera verification").uncheck();
      await page.getByRole("button", { name: "Begin encounter" }).click();
      await page
        .getByRole("button", { name: new RegExp(exercise.name) })
        .click();
      const camera = page.locator(".exercise-camera");
      await expect(camera).toBeVisible();
      await expect(
        camera
          .getByRole("region", { name: "Exercise progress" })
          .getByText(exercise.setup),
      ).toBeVisible();
      const before = await read();
      expect(before.battle.attack.exercise).toBe(exercise.id);
      expect(before.battle.progress).toBe(0);
      await page
        .getByRole("button", {
          name: "I completed the remaining units",
          exact: true,
        })
        .click();
      await expect
        .poll(async () => (await read()).battle.progress)
        .toBeGreaterThan(0);
      const after = await read();
      expect(after.battle.enemyHp).toBeLessThan(before.battle.enemyHp);
      expect(after.battle.verified).toBe(0);
      expect(after.battle.unverified).toBe(after.battle.progress);
      expect(after.battle.attack.id).toBe(exercise.id);
      await page.screenshot({
        path: `/tmp/everstride-home-${exercise.id}-battle.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
      results.push({
        exercise: exercise.id,
        guide: true,
        equipped: true,
        damage: before.battle.enemyHp - after.battle.enemyHp,
        progress: after.battle.progress,
        target: after.battle.attack.units,
        turn: after.battle.turn,
        unverified: after.battle.unverified,
        errors,
      });
    } catch (e) {
      await page.screenshot({
        path: `/tmp/everstride-home-${exercise.id}-failure.png`,
        fullPage: true,
      });
      throw e;
    } finally {
      await context.close();
    }
  }
  console.log(
    JSON.stringify({
      passed: true,
      physicalExerciseValidation: false,
      results,
    }),
  );
} finally {
  await browser.close();
}
