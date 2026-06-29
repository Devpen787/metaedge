import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await new Promise(resolve => setTimeout(resolve, 3000));
  const html = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  console.log('Root HTML length:', html?.length);
  console.log('Root HTML preview:', html?.substring(0, 500));
  await browser.close();
})();
