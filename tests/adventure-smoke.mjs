import { chromium, expect } from '@playwright/test';

// Fresh isolated browser. No save writes, fake progression or synthetic pose events.
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const hold = async (key, duration) => {
  await page.keyboard.down(key);
  try { await page.waitForTimeout(duration); } finally { await page.keyboard.up(key); }
};
const readAdventure = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('everstride');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const read = db.transaction('state', 'readonly').objectStore('state').get('adventure');
    read.onsuccess = () => { resolve(read.result); db.close(); };
    read.onerror = () => { reject(read.error); db.close(); };
  };
}));
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Take the first step' }).click();
  await expect(page.getByText('Opening the village…', { exact: true })).toHaveCount(0);
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(400);

  // From the entrance: step east of the fountain, then south to the trainer.
  await hold('d', 550);
  const trainer = page.getByRole('button', { name: /E · Moss · first steps/ });
  for (let attempt = 0; attempt < 8 && !(await trainer.isVisible()); attempt++) await hold('s', 140);
  await expect(trainer).toBeVisible();
  // Hold a real key press across Phaser render frames.
  await page.keyboard.press('e', { delay: 150 });
  await expect(page.getByRole('heading', { name: 'Prepare for your next chapter' })).toBeVisible();
  await page.screenshot({ path: '/tmp/everstride-encounter-preview.png' });
  await page.getByLabel('Use camera verification').uncheck();
  await page.getByRole('button', { name: 'Begin encounter' }).click();
  const victory = page.getByRole('heading', { name: 'A well-earned victory.' });
  for (let series = 0; series < 10 && !(await victory.isVisible()); series++) {
    await page.getByRole('button', { name: /Earthbound/ }).click();
    await page.getByRole('button', { name: 'I completed the remaining units' }).click();
    await expect.poll(async () => await victory.isVisible() || await page.getByRole('button', { name: /Earthbound/ }).isVisible()).toBe(true);
  }
  await expect(victory).toBeVisible();
  await page.getByRole('button', { name: 'Continue adventure' }).click();
  await page.locator('canvas').waitFor();
  await expect.poll(async () => (await readAdventure())?.player.defeated.includes('trainer-1')).toBe(true);
  const beforeReload = await readAdventure();
  expect(beforeReload.player.coins).toBe(70);
  expect(beforeReload.player.xp).toBe(35);
  expect(beforeReload.player.claimedBattles).toHaveLength(1);
  expect(beforeReload.battle).toBeNull();

  await page.reload();
  await page.locator('canvas').waitFor();
  await expect(page.getByRole('button', { name: 'Take the first step' })).toHaveCount(0);
  const afterReload = await readAdventure();
  expect(afterReload.player.defeated).toEqual(beforeReload.player.defeated);
  expect(afterReload.player.coins).toBe(beforeReload.player.coins);
  expect(afterReload.player.xp).toBe(beforeReload.player.xp);
  expect(afterReload.player.claimedBattles).toEqual(beforeReload.player.claimedBattles);
  await page.screenshot({ path: '/tmp/everstride-after-victory.png', fullPage: true });
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ passed: true, flow: 'keyboard navigation → trainer interaction → manual combat → victory → earned rewards → reload persistence', coins: afterReload.player.coins, xp: afterReload.player.xp, errors }));
} catch (error) {
  await page.screenshot({ path: '/tmp/everstride-adventure-failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
