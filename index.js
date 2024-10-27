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

async function searchForTargetUrl(page, targetUrl, targetScreenshotPath, maxPages) {
    for (let currentPage = 0; currentPage < maxPages; currentPage++) {
        try {
            // Wait for search result links to load
            await page.waitForSelector('div#search a', { timeout: 10000 });

            // Get all links in the search results
            const links = await page.$$eval('div#search a', elements => elements.map(el => el.href));

            // Check if the target URL is in the current page's search results
            const position = links.findIndex(link => link.includes(targetUrl));

            if (position !== -1) {
                await page.screenshot({ path: targetScreenshotPath, fullPage: true });
                return { found: true, position: position + 1, pageCount: currentPage + 1 };
            }

            // Go to the next page if the target URL is not found
            const nextPageButton = await page.$('a#pnnext');
            if (nextPageButton) {
                await nextPageButton.click();
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForTimeout(1000); // Short delay to prevent rapid requests
            } else {
                break;
            }
        } catch (error) {
            console.error(`Error on page ${currentPage + 1}:`, error);
            break;
        }
    }

    // Return if no match found within maxPages
    return { found: false, position: -1, pageCount: maxPages };
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

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36'
        );

        const maxPages = 2;

        // Step 1: Go to Google and search for the keyword
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await acceptGoogleConsentPopup(page);

        // Take the initial screenshot of the first search result page
        await page.screenshot({ path: initialScreenshotPath, fullPage: true });

        // Perform iterative search for target URL
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
