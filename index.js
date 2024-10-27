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
    const { keyword } = req.query;

    if (!keyword) {
        return res.status(400).send('Keyword is required');
    }

    const hash = crypto.createHash('md5').update(keyword).digest('hex');
    const cacheFile = path.join(cacheDir, `${hash}.png`);

    try {
        // Use cache if screenshot already exists
        if (fs.existsSync(cacheFile)) {
            return res.json({
                keyword,
                screenshotPath: `/cache/${hash}.png`,
                cached: true
            });
        }

        // Launch browser and search Google
        const browser = await getBrowserInstance();
        const page = await browser.newPage();

        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, { waitUntil: 'networkidle2' });
        
        // Take a screenshot of the Google search results
        await page.screenshot({ path: cacheFile, fullPage: true });

        await page.close();
        await browser.close();

        res.json({
            keyword,
            screenshotPath: `/cache/${hash}.png`,
            cached: false
        });
    } catch (error) {
        console.error('Error taking screenshot:', error);
        res.status(500).send(`Error taking screenshot: ${error.message}`);
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
