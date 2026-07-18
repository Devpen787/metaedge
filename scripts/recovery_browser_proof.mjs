import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const output = path.join(process.cwd(), 'output', 'playwright', 'flywheel-recovery');
const baseUrl = process.env.METAEDGE_URL || 'http://127.0.0.1:3000';
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

async function capture(name, viewport) {
  const page = await browser.newPage(); await page.setViewport(viewport);
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30_000 });
  const needsEntry = await page.evaluate(() => document.body.innerText.includes('Enter Paper Room'));
  if (needsEntry) {
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Enter Paper Room'));
      button?.click();
    });
    await page.waitForFunction(() => [...document.querySelectorAll('button')]
      .some((node) => node.textContent?.includes('Research Fleet')), { timeout: 15_000 });
  }
  await page.evaluate(() => {
    const dismiss = [...document.querySelectorAll('button')].find((node) => node.className.includes('absolute top-6 right-6'));
    dismiss?.click();
  });
  const clicked = await page.evaluate(() => {
    const element = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Research Fleet'));
    if (!element) return false; element.click(); return true;
  });
  if (!clicked) throw new Error('RESEARCH_FLEET_NAVIGATION_NOT_FOUND');
  await page.waitForFunction(() => document.body.innerText.includes('Research Fleet')
    && document.body.innerText.includes('Live locked'), { timeout: 15_000 });
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const text = await page.evaluate(() => document.body.innerText);
  for (const required of ['Research Fleet', 'Paper only', 'Live locked', 'no_promoted_alpha']) {
    if (!text.includes(required)) throw new Error(`BROWSER_PROOF_TEXT_MISSING:${required}`);
  }
  const file = path.join(output, `${name}.png`); await page.screenshot({ path: file, fullPage: true });
  await page.close(); return { file, viewport, requiredTextPresent: true };
}

const captures = [await capture('research-fleet-desktop', { width: 1440, height: 1000, deviceScaleFactor: 1 }),
  await capture('research-fleet-mobile', { width: 390, height: 844, deviceScaleFactor: 1 })];
await browser.close();
const manifest = { schemaVersion: 1, generatedAt: Date.now(), captures, liveExecution: 'locked' };
fs.writeFileSync(path.join(output, 'browser-proof.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
