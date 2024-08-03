const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const sharp = require('sharp');
const sslChecker = require('ssl-checker');

const app = express();
const port = 3000;
const cacheDir = path.join(__dirname, 'cache');

app.use(cors());

if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
}

app.get('/screenshot', async (req, res) => {
    const { url: inputUrl, device = 'desktop', refresh = false } = req.query;

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
        // Launch a new browser instance
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox', // Disables the sandbox, can improve performance, but slightly less secure
                '--disable-setuid-sandbox', // Disables the setuid sandbox
                '--disable-dev-shm-usage', // Avoid using `/dev/shm` (shared memory), useful in low-memory environments
                '--disable-accelerated-2d-canvas', // Disables hardware acceleration for 2D canvas, reduces GPU usage
                '--disable-gpu', // Disables GPU hardware acceleration, reduces GPU usage
                '--no-zygote', // Disables the zygote process forking, which is used to spawn renderer processes
                '--single-process', // Runs Chrome in a single process, reduces memory usage
                '--disable-background-networking', // Disables background networking
                '--disable-background-timer-throttling', // Disables throttling of background timers
                '--disable-backgrounding-occluded-windows', // Disables backgrounding of windows when they are not visible
                '--disable-breakpad', // Disables crash reporting
                '--disable-client-side-phishing-detection', // Disables client-side phishing detection
                '--disable-default-apps', // Disables default apps on Chrome
                '--disable-extensions', // Disables all extensions
                '--disable-hang-monitor', // Disables the hang monitor
                '--disable-popup-blocking', // Disables popup blocking
                '--disable-prompt-on-repost', // Disables prompt on repost
                '--disable-sync', // Disables syncing to Google services
                '--disable-translate', // Disables built-in Google Translate service
                '--metrics-recording-only', // Enables only metrics recording, useful for performance monitoring
                '--mute-audio', // Mutes any audio output from Chrome
                '--no-first-run', // Skips the first run wizards
                '--safebrowsing-disable-auto-update', // Disables auto-updates of Safe Browsing
                '--ignore-certificate-errors', // Ignores certificate errors
                '--ignore-ssl-errors', // Ignores SSL errors
                '--no-default-browser-check', // Skips default browser check
                '--disable-infobars', // Disables infobars that could be shown on top of the page
            ],
            headless: true
        });

        // Check SSL
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

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
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
            await browser.close(); // Ensure the browser is closed
        }
    }
});

app.use('/cache', express.static(cacheDir));

// Handle PM2 shutdown signals
process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing browser if open');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing browser if open');
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Screenshot service running at http://localhost:${port}`);
});
