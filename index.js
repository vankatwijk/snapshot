const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const sharp = require('sharp');
const sslChecker = require('ssl-checker');
const { connectVpn, disconnectVpn } = require('./vpnManager'); // Import the VPN manager

const app = express();
const port = 3000;
const cacheDir = path.join(__dirname, 'cache');

app.use(cors());

if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
}

const BROWSER_POOL_SIZE = 3;
const browserPool = [];
let browserInitialized = false;

async function createBrowser() {
    try {
        const browser = await puppeteer.launch({
            args: ['--unlimited-storage', '--full-memory-crash-report', '--no-sandbox', '--disable-setuid-sandbox'],
            ignoreHTTPSErrors: true
        });
        return browser;
    } catch (error) {
        console.error('Failed to create a browser instance:', error);
        throw error;
    }
}

async function initBrowserPool() {
    const browserPromises = [];
    for (let i = 0; i < BROWSER_POOL_SIZE; i++) {
        browserPromises.push(createBrowser());
    }

    try {
        const browsers = await Promise.all(browserPromises);
        browserPool.push(...browsers);
        browserInitialized = true;
        console.log('Browser pool initialized with', BROWSER_POOL_SIZE, 'browsers');
    } catch (error) {
        console.error('Failed to initialize the browser pool:', error);
        setTimeout(initBrowserPool, 5000); // Retry after 5 seconds
    }
}

async function getBrowserFromPool() {
    if (browserPool.length === 0) {
        throw new Error('All browsers are busy');
    }
    return browserPool.pop();
}

function returnBrowserToPool(browser) {
    browserPool.push(browser);
}

initBrowserPool();

app.get('/screenshot', async (req, res) => {
    if (!browserInitialized) {
        return res.status(503).send('Browser pool not initialized. Please try again later.');
    }

    const { url: inputUrl, device = 'desktop', refresh = false, vpn } = req.query;

    if (!inputUrl) {
        return res.status(400).send('URL is required');
    }

    let url = inputUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
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

    let browser;
    try {
        if (vpn) {
            await connectVpn(vpn);
        }

        browser = await getBrowserFromPool();
        const sslCheck = await sslChecker(url.replace(/^http(s)?:\/\//i, ''), { method: 'GET', port: 443 });

        if (!sslCheck.valid) {
            return res.status(400).json({ error: 'Invalid SSL certificate' });
        }

        const start = Date.now();
        const page = await browser.newPage();

        const ssl = sslCheck.valid;

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

        const screenshotBuffer = await page.screenshot({ fullPage: false, type: 'png' });

        // Compress the screenshot using sharp
        const compressedScreenshotBuffer = await sharp(screenshotBuffer)
            .png({ quality: 50 }) // Adjust the quality as needed
            .toBuffer();

        await page.close(); // Close the page to free up memory

        await fs.promises.writeFile(cacheFile, compressedScreenshotBuffer);

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
    } finally {
        if (browser) {
            returnBrowserToPool(browser);
        }
        if (vpn) {
            await disconnectVpn();
        }
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

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing browser');
    if (browserPool.length > 0) {
        for (const browser of browserPool) {
            await browser.close();
        }
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing browser');
    if (browserPool.length > 0) {
        for (const browser of browserPool) {
            await browser.close();
        }
    }
    process.exit(0);
});
