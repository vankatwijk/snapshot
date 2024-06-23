const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto('https://www.google.com');
        console.log('Page title:', await page.title());
        await browser.close();
    } catch (error) {
        console.error('Error launching browser:', error);
    }
})();
