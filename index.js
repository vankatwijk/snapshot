const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const port = 3000;
const cacheDir = path.join(__dirname, 'cache');

app.use(cors());

if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
}

app.get('/screenshot', async (req, res) => {
    const { url, device = 'desktop', refresh = false } = req.query;

    if (!url) {
        return res.status(400).send('URL is required');
    }

    const hash = crypto.createHash('md5').update(url).digest('hex');
    const cacheFile = path.join(cacheDir, `${hash}.png`);

    if (fs.existsSync(cacheFile) && !refresh) {
        return res.json({
            url,
            ssl: url.startsWith('https://'),
            loadTime: null,
            seo: {
                title: null,
                description: null,
                h1: null
            },
            screenshotPath: `/cache/${hash}.png`,
            cached: true
        });
    }

    try {
        const start = Date.now();
        const browser = await puppeteer.launch({
            args: ['--unlimited-storage', '--full-memory-crash-report','--no-sandbox', '--disable-setuid-sandbox'],
            ignoreHTTPSErrors: true
        });
        const page = await browser.newPage();

        const ssl = url.startsWith('https://');

        if (device === 'mobile') {
            await page.emulate(puppeteer.devices['iPhone 6']);
        } else {
            await page.setViewport({ width: 1280, height: 800 });
        }

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
        const loadTime = Date.now() - start;

        const title = await page.title();
        const description = await page.$eval('meta[name="description"]', element => element.content).catch(() => '');
        const h1 = await page.evaluate(() => {
            const h1Element = document.querySelector('h1');
            return h1Element ? h1Element.innerText : 'No h1 element found';
        });

        const screenshot = await page.screenshot({
            fullPage: false,
            type: 'png'
        });

        await page.close();
        await browser.close();

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

app.use('/cache', express.static(cacheDir));

app.listen(port, () => {
    console.log(`Screenshot service running at http://localhost:${port}`);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1); // Exit the process to avoid unknown states
});
