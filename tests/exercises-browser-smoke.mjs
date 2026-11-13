// Run against a Vite dev server: node tests/exercises-browser-smoke.mjs http://127.0.0.1:5198
// Validates real model/WASM loading and blank-frame inference, not exercise accuracy.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(process.argv[2] || 'http://127.0.0.1:5198');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => new Promise(resolve => {
    const worker = new Worker('/src/exercises/pose.worker.ts', { type: 'module' });
    const finish = result => { clearTimeout(timeout); worker.terminate(); resolve(result); };
    const timeout = setTimeout(() => finish({ error: 'Model startup timeout' }), 30000);
    worker.onerror = event => finish({ error: event.message });
    worker.onmessage = async event => {
      if (event.data.type === 'error') finish(event.data);
      if (event.data.type === 'ready') {
        const canvas = new OffscreenCanvas(320, 240);
        canvas.getContext('2d').fillRect(0, 0, 320, 240);
        const bitmap = canvas.transferToImageBitmap();
        worker.postMessage({ type: 'frame', bitmap, timestamp: performance.now() }, [bitmap]);
      }
      if (event.data.type === 'pose') finish({ type: 'pose', landmarkCount: event.data.landmarks.length });
    };
    worker.postMessage({ type: 'init', wasmUrl: location.origin + '/models/wasm', modelUrl: location.origin + '/models/pose_landmarker_lite.task' });
  }));
  console.log(JSON.stringify(result));
  if (result.type !== 'pose' || result.landmarkCount !== 0) process.exitCode = 1;
} finally { await browser.close(); }
