const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;
const cacheDir = path.join(__dirname, 'cache');

// Ensure the cache directory exists
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
}

app.get('/screenshot', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('URL is required');
    }

    const cacheFile = path.join(cacheDir, `${encodeURIComponent(url)}.png`);

    // Check if the screenshot is cached
    if (fs.existsSync(cacheFile)) {
        return res.json({
            url,
            screenshotPath: `/cache/${encodeURIComponent(url)}.png`,
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

        // Navigate to the page
        await page.goto(url, { waitUntil: 'networkidle2' });
        const loadTime = Date.now() - start;

        // Get SEO information
        const title = await page.title();
        const description = await page.$eval('meta[name="description"]', element => element.content).catch(() => '');
        const h1 = await page.$eval('h1', element => element.innerText).catch(() => '');

        // Take screenshot
        const screenshot = await page.screenshot();

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
            screenshotPath: `/cache/${encodeURIComponent(url)}.png`,
            cached: false
        });
    } catch (error) {
        console.error('Error taking screenshot:', error);
        res.status(500).send(`Error taking screenshot: ${error.message}`);
    }
});

app.use('/cache', express.static(cacheDir));

app.listen(port, () => {
    console.log(`Screenshot service running at http://localhost:${port}`);
});
