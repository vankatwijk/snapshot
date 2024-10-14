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

let browserInstance;

// Define proxies for different countries
const proxies = {
    'japan': { ip: '51.159.185.244', port: '9000', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'usa': { ip: '51.159.185.244', port: '9002', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'spain': { ip: '51.159.185.244', port: '9001', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'france': { ip: '51.159.185.244', port: '9003', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' }
};

async function getBrowserInstance(proxy) {
    if (!browserInstance) {
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            `--proxy-server=${proxy}`
        ];

        if (proxy) {
            args.push(`--proxy-server=${proxy}`);
        }

        browserInstance = await puppeteer.launch({ args, headless: true });
    }
    return browserInstance;
}

app.get('/screenshot', async (req, res) => {
    const { url: inputUrl, device = 'desktop', refresh = false, country } = req.query;

    if (!inputUrl) {
        return res.status(400).send('URL is required');
    }

    let url = inputUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    const proxyDetails = proxies[country];
    if (country && !proxyDetails) {
        return res.status(400).send(`Proxy for country "${country}" not available`);
    }

    const hash = crypto.createHash('md5').update(url + (country || '')).digest('hex');
    const cacheFile = path.join(cacheDir, `${hash}.png`);

    if (fs.existsSync(cacheFile) && !refresh) {
        return res.json({
            url,
            ssl: url.startsWith('https://'),
            loadTime: null,
            seo: { title: null, description: null, h1: null },
            screenshotPath: `/cache/${hash}.png`,
            cached: true
        });
    }

    try {
        const browser = await getBrowserInstance(proxyDetails ? `http://${proxyDetails.ip}:${proxyDetails.port}` : null);
        const page = await browser.newPage();

        if (proxyDetails && proxyDetails.username && proxyDetails.password) {
            await page.authenticate({ username: proxyDetails.username, password: proxyDetails.password });
        }

        if (device === 'mobile') {
            await page.emulate(puppeteer.devices['iPhone 6']);
        } else {
            await page.setViewport({ width: 1280, height: 800 });
        }

        const start = Date.now();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 }); // 2 minutes
        const loadTime = Date.now() - start;

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
        await page.close();

        res.json({
            url,
            ssl: url.startsWith('https://'),
            loadTime,
            seo: { title, description, h1 },
            screenshotPath: `/cache/${hash}.png`,
            cached: false
        });
    } catch (error) {
        console.error('Error taking screenshot:', error);
        res.status(500).send(`Error taking screenshot: ${error.message}`);
    }
});

app.use('/cache', express.static(cacheDir));

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing browser if open');
    if (browserInstance) await browserInstance.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing browser if open');
    if (browserInstance) await browserInstance.close();
    process.exit(0);
});

process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled Rejection:', reason);
    if (browserInstance) await browserInstance.close();
    process.exit(1);
});

process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    if (browserInstance) await browserInstance.close();
    process.exit(1);
});

app.listen(port, () => {
    console.log(`Screenshot service running at http://localhost:${port}`);
});
