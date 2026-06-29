import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  let requestCount = 0;
  page.on('request', request => {
    requestCount++;
  });
  
  await page.goto('http://localhost:3000');
  
  const btn = await page.$('button[type="submit"]');
  if (btn) {
    await page.type('input[type="text"]', 'TestUser');
    await btn.click();
  }
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('Total requests in 5 seconds:', requestCount);
  await browser.close();
})();
