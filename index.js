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

async function searchForTargetUrl(page, targetUrl, targetScreenshotPath, maxPages, currentPage = 0) {
    if (currentPage >= maxPages) {
        return { found: false, position: -1, pageCount: currentPage };
    }

    // Wait for search result links to load
    await page.waitForSelector('div#search a', { timeout: 10000 });

    // Get all links in the search results
    const links = await page.$$eval('div#search a', elements => elements.map(el => el.href));

    // Check if the target URL is in the current page's search results
    const position = links.findIndex(link => link.includes(targetUrl));

    if (position !== -1) {
        // Take a screenshot of the page where the target URL was found
        await page.screenshot({ path: targetScreenshotPath, fullPage: true });
        return { found: true, position: position + 1, pageCount: currentPage + 1 };
    }

    // Try to go to the next page if the target URL is not found
    const nextPageButton = await page.$('a#pnnext');
    if (nextPageButton) {
        // Add a slight delay before clicking the next button to avoid rate-limiting
        await page.waitForTimeout(1000);
        
        // Click the "Next" button and wait for navigation to complete
        await Promise.all([
            nextPageButton.click(),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
        ]);

        // Recur to the next page
        return await searchForTargetUrl(page, targetUrl, targetScreenshotPath, maxPages, currentPage + 1);
    }

    // Return if no more pages are available
    return { found: false, position: -1, pageCount: currentPage + 1 };
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

        const maxPages = 2; // Limit to 2 pages

        // Step 1: Go to Google and search for the keyword
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Accept the consent popup if it appears
        await acceptGoogleConsentPopup(page);

        // Take the initial screenshot of the first search result page
        await page.screenshot({ path: initialScreenshotPath, fullPage: true });

        // Perform recursive search for target URL
        const { found, position, pageCount } = await searchForTargetUrl(page, targetUrl, targetScreenshotPath, maxPages);

        await page.close();
        await browser.close();

        // Return the response with position and screenshots
        res.json({
            keyword,
            targetUrl,
            position: found ? position : 'Not found',
            pageCount: found ? pageCount : 'Not found',
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
