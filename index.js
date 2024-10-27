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
    const targetScreenshotPath = path.join(cacheDir, `${hash}_target.png`);

    let browser, page;
    try {
        browser = await getBrowserInstance();
        page = await browser.newPage();

        // Set user agent to simulate a real browser
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36'
        );

        let found = false;
        let position = -1;
        let pageCount = 0;
        const maxPages = 2; // Limit the number of pages to 2

        // Step 1: Go to Google and search for the keyword
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Accept the consent popup if it appears
        await acceptGoogleConsentPopup(page);

        // Take the initial screenshot of the first search result page
        await page.screenshot({ path: initialScreenshotPath, fullPage: true });

        while (!found && pageCount < maxPages) {
            try {
                // Wait for search result links to load
                await page.waitForSelector('div#search a', { timeout: 10000 });
        
            } catch (error) {
                console.error(`Error on page ${pageCount + 1}:`, error);
                break; // Exit loop if there is an error
            }
        }

        await page.close();
        await browser.close();

        // Return the response with position and screenshots
        res.json({
            keyword,
            targetUrl,
            position: found ? position : 'Not found',
            pageCount: found ? pageCount + 1 : 'Not found',
            screenshots: {
                initial: `/cache/${hash}_initial.png`,
                target: found ? `/cache/${hash}_target.png` : null
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
