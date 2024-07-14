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

function connectVpn(country) {
    return new Promise((resolve, reject) => {
        if (currentVpnConnection) {
            disconnectVpn().catch(reject);
        }

        const configFilePath = path.join(vpnConfigDir, vpnConfigMap[country]);
        const authFilePath = path.join(vpnConfigDir, 'auth.txt');

        if (!fs.existsSync(authFilePath)) {
            return reject(new Error('VPN authentication file not found'));
        }

        console.log(`Connecting to VPN with config: ${configFilePath}`);
        const vpn = openvpnmanager.connect({
            config: configFilePath,
            ovpnOptions: ['--auth-user-pass', authFilePath],
            logpath: 'log.txt',
            verbosity: 1
        }, {
            host: '127.0.0.1',
            port: 1337,
            timeout: 1500
        });

        vpn.on('connected', async () => {
            console.log('VPN connected');
            currentVpnConnection = vpn;
            // Add delay to ensure connection
            await new Promise(resolve => setTimeout(resolve, 5000));
            resolve();
        });

        vpn.on('error', (err) => {
            console.error('VPN connection error:', err);
            reject(err);
        });

        vpn.on('disconnected', () => {
            currentVpnConnection = null;
            console.log('VPN disconnected');
        });
    });
}

function disconnectVpn() {
    return new Promise((resolve, reject) => {
        if (currentVpnConnection) {
            currentVpnConnection.disconnect();
            currentVpnConnection.on('disconnected', () => {
                currentVpnConnection = null;
                console.log('VPN disconnected');
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
