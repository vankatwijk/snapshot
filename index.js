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

async function getBrowserInstance() {
    return await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    });
}

async function acceptGoogleConsentPopup(page) {
    try {
        await page.waitForSelector('button#L2AGLb', { timeout: 5000 });
        await page.click('button#L2AGLb');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
    } catch (error) {
        console.warn("Consent popup not found or couldn't be clicked:", error);
    }
}

app.get('/search-screenshot', async (req, res) => {
    const { keyword } = req.query;

    if (!keyword) {
        return res.status(400).send('Keyword is required');
    }

    const hash = crypto.createHash('md5').update(keyword).digest('hex');
    const initialScreenshotPath = path.join(cacheDir, `${hash}_initial.png`);

    let browser, page;
    try {
        // Initialize Puppeteer and open a new page
        browser = await getBrowserInstance();
        page = await browser.newPage();

        // Set a user agent to mimic a real browser
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36'
        );

        // Step 1: Go to Google and search for the keyword
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle2',
            timeout: 60000  // 1-minute timeout for the initial page load
        });

        // Accept the consent popup if it appears
        await acceptGoogleConsentPopup(page);

        // Take the initial screenshot of the first search result page
        await page.screenshot({ path: initialScreenshotPath, fullPage: true });

        await page.close();
        await browser.close();

        // Return the response with just the initial screenshot
        res.json({
            keyword,
            screenshots: {
                initial: `/cache/${hash}_initial.png`
            }
        });
    } catch (error) {
        console.error('Error during search screenshot process:', error);
        res.status(500).send(`Error: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
});

// Serve cached screenshots
app.use('/cache', express.static(cacheDir));

// Start the server with an increased timeout of 5 minutes (300000 ms)
const server = app.listen(port, () => {
    console.log(`Search screenshot service running at http://localhost:${port}`);
});

server.timeout = 300000;  // Increase the server timeout to 5 minutes

// Graceful shutdown
const shutdown = async () => {
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', shutdown);
process.on('uncaughtException', shutdown);
