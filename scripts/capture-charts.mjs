/**
 * Capture attenuation chart screenshots for docs.
 * Usage: node scripts/capture-charts.mjs
 */
import puppeteer from 'puppeteer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, 'attenuation-charts.html');
const outDir = resolve(__dirname, '..', 'docs', 'images');

const charts = [
  { id: 'chart1', name: 'attenuation-vs-mash-temp.png', height: 600 },
  { id: 'chart2', name: 'attenuation-slope-comparison.png', height: 500 },
  { id: 'chart3', name: 'step-mash-scenarios.png', height: 500 },
  { id: 'chart4', name: 'enzyme-work-ratio.png', height: 600 },
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 900 });
await page.goto(`http://localhost:8765/attenuation-charts.html`, { waitUntil: 'networkidle2', timeout: 15000 });

// Wait for Chart.js to render
await page.waitForFunction(() => {
  const canvases = document.querySelectorAll('canvas');
  return canvases.length >= 4;
}, { timeout: 10000 });
await new Promise(r => setTimeout(r, 1000)); // extra render time

for (const chart of charts) {
  const canvas = await page.$(`#${chart.id}`);
  if (canvas) {
    await canvas.screenshot({ path: resolve(outDir, chart.name), type: 'png' });
    console.log(`✅ Saved ${chart.name}`);
  } else {
    console.log(`❌ Canvas #${chart.id} not found`);
  }
}

await browser.close();
console.log(`\nDone. Images in: docs/images/`);
