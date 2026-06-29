import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Listen for console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:3000');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Is it welcome screen?
  const btn = await page.$('button[type="submit"]');
  if (btn) {
    console.log('Found welcome screen. Submitting...');
    await page.type('input[type="text"]', 'TestUser');
    await btn.click();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const html = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  console.log('Root HTML length after submit:', html?.length);
  await browser.close();
})();
