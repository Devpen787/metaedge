import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  let requests = {};
  page.on('request', request => {
    let url = request.url();
    requests[url] = (requests[url] || 0) + 1;
  });
  
  await page.goto('http://localhost:3000');
  
  const btn = await page.$('button[type="submit"]');
  if (btn) {
    await page.type('input[type="text"]', 'TestUser');
    await btn.click();
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('Request counts:', JSON.stringify(requests, null, 2));
  await browser.close();
})();
