const openvpnmanager = require('node-openvpn');
const path = require('path');
const fs = require('fs');

const vpnConfigDir = path.join(__dirname, 'serverListUDP');

const vpnConfigMap = {
    Spain: 'NCVPN-ES-Valencia-UDP.ovpn',
    France: 'NCVPN-FR-Paris-UDP.ovpn',
    USA: 'NCVPN-US-Los Angeles-UDP.ovpn',
    Canada: 'NCVPN-CA-Toronto-UDP.ovpn',
    Japan: 'NCVPN-JP-Tokyo-UDP.ovpn'
};

let currentVpnConnection = null;

async function connectVpn(country) {
    if (currentVpnConnection) {
        await disconnectVpn();
    }

    const configFilePath = path.join(vpnConfigDir, vpnConfigMap[country]);
    const authFilePath = path.join(vpnConfigDir, 'auth.txt');

    if (!fs.existsSync(authFilePath)) {
        throw new Error('VPN authentication file not found');
    }

    return new Promise((resolve, reject) => {
        console.log(`Connecting to VPN with config: ${configFilePath}`);
        currentVpnConnection = openvpnmanager.connect({
            config: configFilePath,
            ovpnOptions: ['--auth-user-pass', authFilePath],
            logpath: 'log.txt',
            verbosity: 1
        });

        currentVpnConnection.on('connected', async () => {
            console.log('VPN connected');
            await new Promise(resolve => setTimeout(resolve, 5000)); // Add delay to ensure connection
            resolve();
        });

        currentVpnConnection.on('error', (err) => {
            console.error('VPN connection error:', err);
            reject(err);
        });

        currentVpnConnection.on('disconnected', () => {
            currentVpnConnection = null;
            console.log('VPN disconnected');
        });
    });
}

function disconnectVpn() {
    return new Promise((resolve, reject) => {
        if (currentVpnConnection) {
            console.log('Disconnecting VPN');
            currentVpnConnection.on('disconnected', () => {
                currentVpnConnection = null;
                console.log('VPN disconnected');
                resolve();
            });

            currentVpnConnection.on('error', (err) => {
                console.error('Error during VPN disconnection:', err);
                reject(err);
            });

            currentVpnConnection.disconnect();
        } else {
            console.log('No VPN connection to disconnect');
            resolve();
        }
    });
}

module.exports = {
    connectVpn,
    disconnectVpn
};
