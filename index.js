const express = require('express'); 
const puppeteer = require('puppeteer'); 
const app = express(); 
const port = 3000; 

app.get('/screenshot', async (req, res) => {
    const { url } = req.query; 
    if (!url) { 
        return res.status(400).send('URL is required');
    }
    try { 
        const browser = await puppeteer.launch({ 
	    args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage(); 
	await page.goto(url, { waitUntil: 'networkidle2' }); 
	const screenshot = await page.screenshot(); 

	await browser.close(); 

	res.set('Content-Type', 'image/png'); 
        res.send(screenshot);
    } catch (error) {
        console.error('Error taking screenshot:', error);
        res.status(500).send(`Error taking screenshot: ${error.message}`);
    }
});

app.listen(port, () => { 

	console.log(`Screenshot service running at http://localhost:${port}`);
});
