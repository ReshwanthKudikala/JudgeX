import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, 'layout-fixture.html');

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('file://' + file.replace(/\\/g, '/'));
await page.waitForFunction(() => window.__REPORT__);
const report = await page.evaluate(() => window.__REPORT__);
console.log(JSON.stringify(report, null, 2));
await browser.close();
