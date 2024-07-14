const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const { fork } = require('child_process');
const { connectVpn, disconnectVpn } = require('./vpnManager');

const app = express();
const port = 3000;
const cacheDir = path.join(__dirname, 'cache');

app.use(cors());

if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
}

app.get('/screenshot', async (req, res) => {
    const { url: inputUrl, device = 'desktop', refresh = false, vpn } = req.query;

    if (!inputUrl) {
        return res.status(400).send('URL is required');
    }

    let url = inputUrl.startsWith('http://') || inputUrl.startsWith('https://') ? inputUrl : 'https://' + inputUrl;
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const cacheFile = path.join(cacheDir, `${hash}.png`);

    if (fs.existsSync(cacheFile) && !refresh) {
        return res.json({
            url,
            ssl: url.startsWith('https://'),
            loadTime: null,
            seo: {
                title: null,
                description: null,
                h1: null
            },
            screenshotPath: `/cache/${hash}.png`,
            cached: true
        });
    }

    if (vpn) {
        try {
            console.log(`Connecting to VPN: ${vpn}`);
            await connectVpn(vpn);
        } catch (error) {
            console.error('Error connecting to VPN:', error);
            return res.status(500).send(`Error connecting to VPN: ${error.message}`);
        }
    }

    const child = fork(path.join(__dirname, 'screenshotWorker.js'));

    child.on('message', async (message) => {
        if (message.error) {
            res.status(500).send(`Error taking screenshot: ${message.error}`);
        } else {
            res.json(message);
        }

        if (vpn) {
            try {
                await disconnectVpn();
            } catch (error) {
                console.error('Error disconnecting VPN:', error);
            }
        }
    });

    child.send({ url, device, cacheFile });
});

app.use('/cache', express.static(cacheDir));

app.listen(port, () => {
    console.log(`Screenshot service running at http://localhost:${port}`);
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing browsers and disconnecting VPN');
    try {
        await disconnectVpn();
    } catch (error) {
        console.error('Error disconnecting VPN:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing browsers and disconnecting VPN');
    try {
        await disconnectVpn();
    } catch (error) {
        console.error('Error disconnecting VPN:', error);
    }
    process.exit(0);
});
