/** Presentation-only real DOM controls; no game progression or rewards. */
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1366, height: 768 },
      reducedMotion: "reduce",
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    (process.env.GAME_URL || "http://127.0.0.1:5188") +
      "/tests/fixtures/tutorial.html",
  );
  const target = page.getByRole("button", {
      name: "Actual Attack",
      exact: true,
    }),
    card = page.locator(".guided-card");
  const geometry = async () =>
    page.evaluate(() => {
      const target = document.querySelector('[data-guide="battle-attack"]'),
        card = document.querySelector(".guided-card"),
        outline = document.querySelector(".guided-target-outline");
      if (!target || !card || !outline) return null;
      const t = target.getBoundingClientRect(),
        c = card.getBoundingClientRect(),
        o = outline.getBoundingClientRect();
      return {
        targetHit: target.contains(
          document.elementFromPoint(t.x + t.width / 2, t.y + t.height / 2),
        ),
        inside:
          c.x >= 0 &&
          c.y >= 0 &&
          c.right <= innerWidth + 1 &&
          c.bottom <= innerHeight + 1,
        separate:
          c.right <= t.x ||
          c.x >= t.right ||
          c.bottom <= t.y ||
          c.y >= t.bottom,
        outlineMatches:
          Math.abs(o.x - (t.x - 5)) < 1 &&
          Math.abs(o.y - (t.y - 5)) < 1 &&
          Math.abs(o.width - t.width - 10) < 1,
      };
    });
  for (const [width, height] of [
    [1366, 768],
    [844, 390],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await expect.poll(geometry).toEqual({
      targetHit: true,
      inside: true,
      separate: true,
      outlineMatches: true,
    });
    await target.click();
    await page.screenshot({
      path: `/tmp/everstride-guide-overlay-${width}x${height}.png`,
    });
  }
  await expect(page.getByTestId("hits")).toHaveText("3");
  await page.getByTestId("world-control").click();
  await expect(page.getByTestId("hits")).toHaveText("13");
  await page.getByRole("button", { name: "Move target", exact: true }).click();
  await expect.poll(geometry).toEqual({
    targetHit: true,
    inside: true,
    separate: true,
    outlineMatches: true,
  });
  await expect(page.locator(".guided-target-outline")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.getByRole("button", { name: "Understood", exact: true }).click();
  await expect(page.getByTestId("acks")).toHaveText("1");
  await page
    .getByRole("button", { name: "Toggle target", exact: true })
    .click();
  await expect(page.locator(".guided-target-outline")).toHaveCount(0);
  await expect(page.locator(".guided-target-arrow")).toHaveCount(0);
  await expect(card).toContainText("Open the battle controls");
  await page
    .getByRole("button", { name: "Open game help", exact: true })
    .click();
  const help = page.getByRole("dialog", { name: "Game help", exact: true });
  await expect(help).toBeVisible();
  await help.getByRole("combobox").selectOption("journal-food");
  await expect(help).toContainText("Scan a barcode");
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open game help", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Open game help", exact: true })
    .click();
  await help.getByRole("combobox").selectOption("camera");
  await help
    .getByRole("button", { name: "Show me these controls", exact: true })
    .click();
  await expect(help).toHaveCount(0);
  await expect(card).toContainText(
    "Choose an exercise and open its camera controls.",
  );
  await page.getByRole("button", { name: "Guide door", exact: true }).click();
  await expect(page.locator(".guided-tutorial")).toHaveAttribute(
    "data-target-found",
    "true",
  );
  await expect(card).toContainText("Enter the doorway");
  for(const [width,height] of [[1366,768],[844,390],[390,844]]){
    await page.setViewportSize({width,height});await expect(card).toHaveClass(/guided-door/);
    await expect.poll(async()=>{const rect=await card.boundingBox();return rect.x+rect.width;}).toBeGreaterThan(width-24);
    if(width<900){await expect(card).toHaveClass(/guided-door-mobile/);await page.getByRole('button',{name:'Minimize',exact:true}).click();await expect(card.locator('p')).toHaveCount(0);await page.getByRole('button',{name:'Show door tip'}).click();await expect(card.locator('p')).toHaveCount(1);}
    await page.screenshot({path:`/tmp/everstride-door-guide-${width}.png`});
  }
  await page.getByRole("button", { name: "End guide", exact: true }).click();
  await expect(page.locator(".guided-tutorial")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "target bounds track resize/move",
        "arrow and card avoid target",
        "target and unrelated movement remain clickable",
        "missing target fallback has no arrow",
        "explicit acknowledgements only",
        "reduced motion",
        "help scope selection, Escape and focus return",
        "help replay callback",
        "overlay cleanup",
      ],
      errors,
    }),
  );
} finally {
  await browser.close();
}
