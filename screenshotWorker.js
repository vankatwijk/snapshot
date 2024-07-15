const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');  // Add this line
const sharp = require('sharp');

process.on('message', async ({ url, device, cacheFile }) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: ['--unlimited-storage', '--full-memory-crash-report', '--no-sandbox', '--disable-setuid-sandbox'],
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();

        if (device === 'mobile') {
            await page.emulate(puppeteer.devices['iPhone 6']);
        } else {
            await page.setViewport({ width: 1280, height: 800 });
        }

        console.log(`Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
        
        const title = await page.title();
        const description = await page.$eval('meta[name="description"]', element => element.content).catch(() => '');
        const h1 = await page.evaluate(() => {
            const h1Element = document.querySelector('h1');
            return h1Element ? h1Element.innerText : 'No h1 element found';
        });

        const screenshotBuffer = await page.screenshot({ fullPage: false, type: 'png' });

        const compressedScreenshotBuffer = await sharp(screenshotBuffer)
            .png({ quality: 50 })
            .toBuffer();

        await fs.promises.writeFile(cacheFile, compressedScreenshotBuffer);

        process.send({
            url,
            ssl: url.startsWith('https://'),
            seo: {
                title,
                description,
                h1
            },
            screenshotPath: `/cache/${path.basename(cacheFile)}`,
            cached: false
        });
    } catch (error) {
        console.error('Error taking screenshot:', error);
        process.send({ error: error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

