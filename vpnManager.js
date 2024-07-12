// vpnManager.js
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

    // Ensure the auth file exists
    if (!fs.existsSync(authFilePath)) {
        throw new Error('VPN authentication file not found');
    }

    return new Promise((resolve, reject) => {
        const vpn = openvpnmanager.connect({
            config: configFilePath,
            ovpnOptions: ['--auth-user-pass', authFilePath],
            logpath: 'log.txt',
            verbosity: 1
        }, {
            host: '127.0.0.1',
            port: 1337
        });

        vpn.on('connected', () => {
            currentVpnConnection = vpn;
            resolve();
        });

        vpn.on('error', (err) => {
            reject(err);
        });

        vpn.on('disconnected', () => {
            currentVpnConnection = null;
        });
    });
}

function disconnectVpn() {
    return new Promise((resolve) => {
        if (currentVpnConnection) {
            currentVpnConnection.disconnect();
            currentVpnConnection.on('disconnected', () => {
                currentVpnConnection = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

module.exports = {
    connectVpn,
    disconnectVpn
};
