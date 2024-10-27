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

// Proxy setup
const proxies = {
    'japan': { ip: '51.159.185.244', port: '9000', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'usa': { ip: '51.159.185.244', port: '9002', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
    'spain': { ip: '51.159.185.244', port: '9001', username: 'geonode_Gg6rpqlu1v', password: '3d7fd268-77cd-415d-93f0-af389437c99c' },
};

async function getBrowserInstance(proxy = null) {
    const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'];
    if (proxy) {
        args.push(`--proxy-server=${proxy}`);
    }

    return await puppeteer.launch({
        args,
        headless: true,
        dumpio: true
    });
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

    let browser, page;
    try {
        browser = await getBrowserInstance(proxyServer);
        page = await browser.newPage();

        if (proxyDetails && proxyDetails.username && proxyDetails.password) {
            await page.authenticate({ username: proxyDetails.username, password: proxyDetails.password });
        }

        const screenshots = [];
        let position = null;

        // Step 1: Google Search
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('div#search');
        const searchScreenshotPath = path.join(cacheDirKeyword, `google_search.png`);
        await page.screenshot({ path: searchScreenshotPath, fullPage: true });
        screenshots.push({ step: 'google_search', screenshotPath: searchScreenshotPath });

        // Step 2: Find the Target URL
        const links = await page.$$eval('div#search a', elements =>
            elements.map(el => ({ url: el.href, text: el.innerText }))
        );

        for (let i = 0; i < links.length; i++) {
            if (links[i].url.includes(targetUrl)) {
                position = i + 1;

                // Screenshot with position of target URL
                const targetScreenshotPath = path.join(cacheDirKeyword, `search_result_position_${position}.png`);
                await page.screenshot({ path: targetScreenshotPath, fullPage: true });
                screenshots.push({ step: 'search_result', position, screenshotPath: targetScreenshotPath });

                // Step 3: Click the Target URL and Screenshot Landing Page
                await page.click(`a[href="${links[i].url}"]`);
                await page.waitForNavigation({ waitUntil: 'networkidle2' });

                const landingScreenshotPath = path.join(cacheDirKeyword, `landing_page.png`);
                await page.screenshot({ path: landingScreenshotPath, fullPage: true });
                screenshots.push({ step: 'landing_page', screenshotPath: landingScreenshotPath });

                // Step 4: Click a Random Internal Link
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
    } finally {
        if (browser) await browser.close();
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
