// vpnManager.js
const openvpnmanager = require('node-openvpn');
const path = require('path');
const fs = require('fs');

const vpnConfigDir = path.join(__dirname, 'serverListUDP');

const vpnConfigMap = {
    Spain: 'NCVPN-ES-Valencia-TCP.ovpn',
    France: 'NCVPN-FR-Paris-TCP.ovpn',
    USA: 'NCVPN-US-Los Angeles-TCP.ovpn',
    Canada: 'NCVPN-CA-Toronto-TCP.ovpn',
    Japan: 'NCVPN-JP-Tokyo-TCP.ovpn'
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
            logpath: 'log.txt'
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
