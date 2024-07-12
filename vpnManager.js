// vpnManager.js
const { openvpnmanager } = require('node-openvpn');
const path = require('path');

const vpnConfigDir = path.join(__dirname, 'serverListTCP');

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
    return new Promise((resolve, reject) => {
        const vpn = openvpnmanager.connect({
            config: configFilePath
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
