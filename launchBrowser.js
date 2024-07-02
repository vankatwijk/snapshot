const puppeteer = require('puppeteer');
const maxRetries = 5;

async function launchBrowser(retries = 0) {
    try {
        return await puppeteer.launch({
            args: ['--unlimited-storage', 
                   '--full-memory-crash-report',
                   '--no-sandbox', 
                   '--disable-setuid-sandbox'],
            ignoreHTTPSErrors: true
        });
    } catch (error) {
        if (retries < maxRetries) {
            console.error(`Error launching browser, retrying... (${retries + 1}/${maxRetries})`);
            return await launchBrowser(retries + 1);
        } else {
            throw new Error('Failed to launch browser after multiple retries');
        }
    }
}

module.exports = launchBrowser;
