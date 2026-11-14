// Run from the project root, where @playwright/test is installed.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
const require = createRequire(resolve(process.cwd(), 'package.json'));
const {chromium, expect} = require('@playwright/test');
const root = fileURLToPath(new URL('.', import.meta.url));
await fs.mkdir(resolve(root, 'qa'), {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('requestfailed', r => errors.push(`${r.url()}: ${r.failure()?.errorText}`));
const viewports = [[1920,1080],[1366,768],[1280,720],[915,412],[800,360],[390,844]];
try {
  await page.goto(new URL('./index.html', import.meta.url).href);
  await expect(page.locator('#choices article')).toHaveCount(3);
  await page.locator('img').evaluateAll(async imgs => await Promise.all(imgs.map(img => img.decode())));
  const images = await page.locator('img.sprite, img.zoom').evaluateAll(imgs => imgs.map(img => ({source: img.getAttribute('src'), native: [img.naturalWidth,img.naturalHeight], rendered: [img.width,img.height], rendering: getComputedStyle(img).imageRendering})));
  for (const img of images) {
    const size = img.source.includes('-4x') ? 384 : 96;
    expect(img.native).toEqual([size,size]);
    expect(img.rendered).toEqual([size,size]);
    expect(img.rendering).toBe('pixelated');
  }
  for (const bg of ['dark','checker','light']) {
    await page.locator(`[data-bg="${bg}"]`).click();
    await expect(page.locator(`[data-bg="${bg}"]`)).toHaveAttribute('aria-pressed','true');
    expect(await page.locator(`.stage${bg === 'light' ? ':not(.dark):not(.checker)' : '.' + bg}`).count()).toBe(7);
  }
  for (const [width,height] of viewports) {
    await page.setViewportSize({width,height});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({path: resolve(root, `qa/gallery-${width}x${height}.png`), fullPage: true});
  }
  for (const href of await page.locator('a[href]').evaluateAll(links => links.map(a => a.getAttribute('href')))) {
    expect((await fs.stat(resolve(root, href))).isFile()).toBe(true);
  }
  expect(errors).toEqual([]);
  await fs.writeFile(resolve(root, 'qa/browser-validation.json'), JSON.stringify({passed:true,viewports,images,backgroundControlsPassed:true,allLocalLinksExist:true,errors},null,2)+'\n');
  console.log('Gallery verified: six viewports, six exact sprite sizes, three backgrounds, no missing files or browser errors.');
} finally {
  await browser.close();
}
