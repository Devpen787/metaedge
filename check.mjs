import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await new Promise(resolve => setTimeout(resolve, 2000));
  const errorLog = await page.evaluate(() => document.getElementById('error-log')?.innerText);
  console.log('Error Log:', errorLog);
  await browser.close();
})();
