const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
const port = 3000;
const cacheDir = path.join(__dirname, 'cache');

// Ensure the cache directory exists
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
}

app.get('/screenshot', async (req, res) => {
    const { url, device = 'desktop' } = req.query;  // Add device query parameter

    if (!url) {
        return res.status(400).send('URL is required');
    }

    const hash = crypto.createHash('md5').update(url).digest('hex');
    const cacheFile = path.join(cacheDir, `${hash}.png`);

    // Check if the screenshot is cached
    if (fs.existsSync(cacheFile)) {
        return res.json({
            url,
            ssl: url.startsWith('https://'),
            loadTime: null,  // This value should be fetched from cache if necessary
            seo: {
                title: null,  // This value should be fetched from cache if necessary
                description: null,  // This value should be fetched from cache if necessary
                h1: null  // This value should be fetched from cache if necessary
            },
            screenshotPath: `/cache/${hash}.png`,
            cached: true
        });
    }

    try {
        const start = Date.now();
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            ignoreHTTPSErrors: true
        });
        const page = await browser.newPage();

        // Check SSL
        const ssl = url.startsWith('https://');

        // Set device emulation
        if (device === 'mobile') {
            await page.emulate(puppeteer.devices['iPhone 6']);
        } else {
            await page.setViewport({ width: 1280, height: 800 });
        }

        // Navigate to the page with a maximum load time of 20 seconds
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
        const loadTime = Date.now() - start;

        // Get SEO information
        const title = await page.title();
        const description = await page.$eval('meta[name="description"]', element => element.content).catch(() => '');
        const h1 = await page.$eval('h1', element => element.innerText).catch(() => '');

        console.log(`Title: ${title}`);
        console.log(`Description: ${description}`);
        console.log(`H1: ${h1}`);

        // Take screenshot with default size
        const screenshot = await page.screenshot({
            //fullPage: true
        });

        await browser.close();

        // Cache the screenshot
        fs.writeFileSync(cacheFile, screenshot);

        res.json({
            url,
            ssl,
            loadTime,
            seo: {
                title,
                description,
                h1
            },
            screenshotPath: `/cache/${hash}.png`,
            cached: false
        });
    } catch (error) {
        console.error('Error taking screenshot:', error);
        res.status(500).send(`Error taking screenshot: ${error.message}`);
    }
});

// Serve cached screenshots
app.use('/cache', express.static(cacheDir));

app.listen(port, () => {
    console.log(`Screenshot service running at http://localhost:${port}`);
});
