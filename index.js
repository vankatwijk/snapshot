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
        // Wait briefly for the popup to load if present
        await page.waitForSelector('button#L2AGLb', { timeout: 5000 });
        
        // Click the "Accept all" button to dismiss the policy popup
        await page.click('button#L2AGLb');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
    } catch (error) {
        console.warn("Consent popup not found or couldn't be clicked:", error);
    }
}

app.get('/search-screenshot', async (req, res) => {
    const { keyword, targetUrl } = req.query;

    if (!keyword || !targetUrl) {
        return res.status(400).send('Both keyword and target URL are required');
    }

    const hash = crypto.createHash('md5').update(keyword + targetUrl).digest('hex');
    const initialScreenshotPath = path.join(cacheDir, `${hash}_initial.png`);

    let browser, page;
        browser = await getBrowserInstance();
        page = await browser.newPage();

        // Set user agent to simulate a real browser
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36'
        );

        // Step 1: Go to Google and search for the keyword
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Accept the consent popup if it appears
        await acceptGoogleConsentPopup(page);

        // Take the initial screenshot of the first search result page
        await page.screenshot({ path: initialScreenshotPath, fullPage: true });


        // Close the page and browser after operation
        await page.close();
        await browser.close();

        // Return JSON response with target URL position
        res.json({
            keyword,
            targetUrl,
            position: position !== -1 ? position + 1 : 'Not found', // Convert to 1-based index if found
            screenshots: {
                initial: `/cache/${hash}_initial.png`
            }
        });
});

// Serve cached screenshots
app.use('/cache', express.static(cacheDir));

// Graceful shutdown
const shutdown = async () => {
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', shutdown);
process.on('uncaughtException', shutdown);

app.listen(port, () => {
    console.log(`Search screenshot service running at http://localhost:${port}`);
});
