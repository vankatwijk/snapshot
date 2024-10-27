const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const sharp = require('sharp');

const app = express();
const port = 3000;
const cacheDir = path.join(__dirname, 'cache');

app.use(cors());

if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
}

let browserInstance;

async function getBrowserInstance(proxy = null) {
    const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'];

    if (proxy) {
        args.push(`--proxy-server=${proxy}`);
    }

    try {
        // Attempt to launch the browser and enable verbose logging with dumpio
        browserInstance = await puppeteer.launch({ 
            args, 
            headless: true, 
            dumpio: true // This will output browser process errors to the console
        });
        return browserInstance;
    } catch (error) {
        console.error("Error launching Puppeteer browser:", error);
        throw new Error("Failed to launch Puppeteer browser. Check the logs for more details.");
    }
}

app.get('/search-screenshot', async (req, res) => {
    const { keyword, targetUrl, country } = req.query;

    if (!keyword || !targetUrl) {
        return res.status(400).send('Keyword and target URL are required');
    }

    const proxyDetails = country ? proxies[country] : null;
    const proxyServer = proxyDetails ? `http://${proxyDetails.ip}:${proxyDetails.port}` : null;

    const hash = crypto.createHash('md5').update(keyword + targetUrl).digest('hex');
    const cacheDirKeyword = path.join(cacheDir, hash);
    if (!fs.existsSync(cacheDirKeyword)) {
        fs.mkdirSync(cacheDirKeyword);
    }

    try {
        const browser = await getBrowserInstance(proxyServer);
        const page = await browser.newPage();

        // Authenticate for proxies with credentials if proxy details are provided
        if (proxyDetails && proxyDetails.username && proxyDetails.password) {
            await page.authenticate({ username: proxyDetails.username, password: proxyDetails.password });
        }

        const results = [];
        let position = null;
        const screenshots = [];

        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('div#search');

        const links = await page.$$eval('div#search a', elements =>
            elements.map(el => ({ url: el.href, text: el.innerText }))
        );

        for (let i = 0; i < links.length; i++) {
            if (links[i].url.includes(targetUrl)) {
                position = i + 1;

                const searchScreenshotPath = path.join(cacheDirKeyword, `search_result_position_${position}.png`);
                await page.screenshot({ path: searchScreenshotPath, fullPage: true });
                screenshots.push({ step: 'search_result', position, screenshotPath: searchScreenshotPath });

                await page.click(`a[href="${links[i].url}"]`);
                await page.waitForNavigation({ waitUntil: 'networkidle2' });

                const landingScreenshotPath = path.join(cacheDirKeyword, `landing_page.png`);
                await page.screenshot({ path: landingScreenshotPath, fullPage: true });
                screenshots.push({ step: 'landing_page', screenshotPath: landingScreenshotPath });

                const internalLinks = await page.$$eval('a', elements =>
                    elements.map(el => el.href).filter(url => url.includes(targetUrl))
                );

                if (internalLinks.length > 0) {
                    const randomLink = internalLinks[Math.floor(Math.random() * internalLinks.length)];
                    await page.goto(randomLink, { waitUntil: 'networkidle2' });

                    const internalScreenshotPath = path.join(cacheDirKeyword, `internal_page.png`);
                    await page.screenshot({ path: internalScreenshotPath, fullPage: true });
                    screenshots.push({ step: 'internal_page', screenshotPath: internalScreenshotPath });
                }
                break;
            }
        }

        await page.close();

        res.json({
            keyword,
            targetUrl,
            country,
            googlePosition: position,
            screenshots,
            message: position ? `Found ${targetUrl} at position ${position}` : `Target URL not found in search results`
        });
    } catch (error) {
        console.error('Error during screenshot process:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.use('/cache', express.static(cacheDir));

const shutdown = async () => {
    if (browserInstance) await browserInstance.close();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', error => {
    console.error('Unhandled Rejection:', error);
    shutdown();
});
process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
    shutdown();
});

app.listen(port, () => {
    console.log(`Search screenshot service running at http://localhost:${port}`);
});
