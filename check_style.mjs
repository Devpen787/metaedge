import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await new Promise(resolve => setTimeout(resolve, 2000));
  const bgColor = await page.evaluate(() => {
    const el = document.querySelector('.bg-\\[\\#060813\\]');
    return el ? window.getComputedStyle(el).backgroundColor : 'not found';
  });
  console.log('Background Color:', bgColor);
  await browser.close();
})();
