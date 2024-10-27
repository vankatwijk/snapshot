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

// Define proxies for different countries
const proxies = {
    'japan': { ip: '51.159.185.244', port: '9000', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'usa': { ip: '51.159.185.244', port: '9002', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'spain': { ip: '51.159.185.244', port: '9001', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'france': { ip: '51.159.185.244', port: '9003', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'australia': { ip: '51.159.185.244', port: '9004', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'canada': { ip: '51.159.185.244', port: '9005', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'vietnam': { ip: '51.159.185.244', port: '9006', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'thailand': { ip: '51.159.185.244', port: '9007', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' }
};

async function getBrowserInstance(proxy = null) {
    const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'];

    if (proxy) {
        args.push(`--proxy-server=${proxy}`);
    }

    return await puppeteer.launch({ args, headless: true });
}

app.get('/search-screenshot', async (req, res) => {
    const { keyword, targetUrl, country } = req.query;

    if (!keyword || !targetUrl) {
        return res.status(400).send('Keyword and target URL are required');
    }

    // Select the proxy based on country if specified
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

        // Authenticate for proxies with credentials
        if (proxyDetails && proxyDetails.username && proxyDetails.password) {
            await page.authenticate({ username: proxyDetails.username, password: proxyDetails.password });
        }

        const results = [];
        let position = null;
        const screenshots = [];

        // Navigate to Google with the proxy if specified
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('div#search');

        // Extract all search result links
        const links = await page.$$eval('div#search a', elements =>
            elements.map(el => ({ url: el.href, text: el.innerText }))
        );

        // Find target URL in the search results
        for (let i = 0; i < links.length; i++) {
            if (links[i].url.includes(targetUrl)) {
                position = i + 1;

                // Take screenshot of search results page
                const searchScreenshotPath = path.join(cacheDirKeyword, `search_result_position_${position}.png`);
                await page.screenshot({ path: searchScreenshotPath, fullPage: true });
                screenshots.push({ step: 'search_result', position, screenshotPath: searchScreenshotPath });

                // Click the link to navigate to the website
                await page.click(`a[href="${links[i].url}"]`);
                await page.waitForNavigation({ waitUntil: 'networkidle2' });

                // Take screenshot of landing page
                const landingScreenshotPath = path.join(cacheDirKeyword, `landing_page.png`);
                await page.screenshot({ path: landingScreenshotPath, fullPage: true });
                screenshots.push({ step: 'landing_page', screenshotPath: landingScreenshotPath });

                // Click a random internal link
                const internalLinks = await page.$$eval('a', elements =>
                    elements
                        .map(el => el.href)
                        .filter(url => url.includes(targetUrl))
                );

                if (internalLinks.length > 0) {
                    const randomLink = internalLinks[Math.floor(Math.random() * internalLinks.length)];
                    await page.goto(randomLink, { waitUntil: 'networkidle2' });

                    // Take screenshot of random internal page
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
            message: position
                ? `Found ${targetUrl} at position ${position}`
                : `Target URL not found in search results`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

// Serve cached screenshots
app.use('/cache', express.static(cacheDir));

// Graceful shutdown
const shutdown = async () => {
    if (browserInstance) await browserInstance.close();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', shutdown);
process.on('uncaughtException', shutdown);

app.listen(port, () => {
    console.log(`Search screenshot service running at http://localhost:${port}`);
});
