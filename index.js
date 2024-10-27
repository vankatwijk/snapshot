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
        const maxPages = 5; // Limit the number of pages to check to avoid indefinite loops

        // Step 1: Go to Google and search for the keyword
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Take the initial screenshot of the first search result page
        await page.screenshot({ path: initialScreenshotPath, fullPage: true });

        while (!found && pageCount < maxPages) {
            // Wait for search result links to load
            await page.waitForSelector('div#search a');

            // Step 2: Get all links in the search results
            const links = await page.$$eval('div#search a', elements => elements.map(el => el.href));

            // Check if the target URL is in the current page's search results
            position = links.findIndex(link => link.includes(targetUrl));

            if (position !== -1) {
                found = true;
                position += 1; // Convert to 1-based index

                // Take a screenshot of the page where the target URL was found
                await page.screenshot({ path: targetScreenshotPath, fullPage: true });
            } else {
                // Try to go to the next page if the target URL is not found
                const nextPageButton = await page.$('a#pnnext');
                if (nextPageButton) {
                    await nextPageButton.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                    pageCount++;
                    await page.waitForTimeout(2000); // Wait for 2 seconds to avoid rate-limiting
                } else {
                    break; // Exit if there's no next page
                }
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
