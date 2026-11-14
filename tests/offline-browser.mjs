import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173');
  await page.getByRole('button', { name: 'Take the first step' }).click();
  await expect(page.locator('.game-hud-player')).toContainText('Adventurer');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.world-frame canvas')).toBeVisible();
  await expect(page.locator('.game-hud-player')).toContainText('Adventurer');
  await expect(page.getByRole('button', { name: 'Take the first step' })).toHaveCount(0);
  await page.screenshot({ path: '/tmp/everstride-final-offline.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Nutrition journal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A good day starts here.' })).toBeVisible();
  console.log(JSON.stringify({ passed: true, checks: ['production worker installed', 'offline reload', 'persisted local adventure', 'offline journal'] }));
} finally { await browser.close(); }
