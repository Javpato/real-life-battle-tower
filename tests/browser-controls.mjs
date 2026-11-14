/** Shared UI navigation only; never changes game state outside visible controls. */
export async function openAttackMenu(page) {
  if (await page.locator(".attack-card").first().isVisible()) return;
  await page.locator(".command-attack").click();
}
export async function openCameraControls(page) {
  // React closes the between-turn drawer when turn/mode changes; wait for that effect/transition.
  await page.waitForTimeout(220);
  const toggle = page.getByRole("button", {
    name: "Camera controls",
    exact: true,
  });
  if (await toggle.isVisible()) await toggle.click();
  await page.locator(".exercise-camera").waitFor({ state: "visible" });
  await page.waitForTimeout(200);
}

export async function dismissExerciseGuide(camera) {
  await camera.waitFor({ state: "visible" });
  // The first-use guide is set by an effect when the attack changes; let the drawer settle.
  await camera.page().waitForTimeout(220);
  const close = camera.getByRole("button", {
    name: "Close exercise guide",
    exact: true,
  });
  if (await close.isVisible()) {
    await close.click();
    return;
  }
  const hide = camera.getByRole("button", { name: "Hide guide", exact: true });
  if (await hide.isVisible()) await hide.click();
}

export async function openCameraSettings(camera) {
  const details = camera
    .locator("details")
    .filter({ hasText: "Camera settings" });
  if (
    (await details.count()) &&
    !(await details.evaluate((element) => element.open))
  )
    await details.locator("summary").click();
}
export async function closeModal(page) {
  await page.getByRole("button", { name: /^Close(?: modal)?$/ }).click();
}
export async function openJournal(page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Nutrition journal", exact: true })
    .click();
}
export async function walkToFirstTrainer(page) {
  const trainer = page.getByRole("button", { name: /E · .* · first steps/ });
  const position = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const q = indexedDB.open("everstride");
          q.onerror = () => reject(q.error);
          q.onsuccess = () => {
            const db = q.result,
              r = db.transaction("state").objectStore("state").get("adventure");
            r.onsuccess = () => {
              resolve(r.result?.player.position ?? { x: 383, y: 262 });
              db.close();
            };
            r.onerror = () => reject(r.error);
          };
        }),
    );
  const step = async (key) => {
    await page.keyboard.down(key);
    try {
      await page.waitForTimeout(180);
    } finally {
      await page.keyboard.up(key);
    }
    await page.waitForTimeout(90);
  };
  await page.waitForTimeout(150);
  for (let i = 0; i < 40 && (await position()).x < 425; i++) await step("d");
  if ((await position()).x < 415)
    throw Error("Character did not move east around the fountain");
  for (let i = 0; i < 40 && !(await trainer.isVisible()); i++) await step("s");
  if (!(await trainer.isVisible()))
    throw Error("First trainer is not reachable through the world controls");
  // Use the visible interaction prompt; no internal scene calls or save edits.
  await trainer.click();
}

export async function closeCameraSettings(camera) {
  const details = camera
    .locator("details")
    .filter({ hasText: "Camera settings" });
  if (
    (await details.count()) &&
    (await details.evaluate((element) => element.open))
  )
    await details.locator("summary").click();
}
