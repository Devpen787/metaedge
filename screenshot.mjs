import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
  console.log('Saved screenshot.png');
})();
