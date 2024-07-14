const { exec } = require('child_process');
const psTree = require('ps-tree');
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

let currentVpnProcess = null;
let managementPort = 1337;

function killProcess(pid, signal = 'SIGKILL') {
    return new Promise((resolve, reject) => {
        psTree(pid, (err, children) => {
            if (err) {
                return reject(err);
            }
            [pid].concat(children.map(p => p.PID)).forEach(tpid => {
                try {
                    process.kill(tpid, signal);
                } catch (ex) {
                    // ignore
                }
            });
            resolve();
        });
    });
}

async function connectVpn(country) {
    if (currentVpnProcess) {
        await disconnectVpn();
    }

    const configFilePath = path.join(vpnConfigDir, vpnConfigMap[country]);
    const authFilePath = path.join(vpnConfigDir, 'auth.txt');

    if (!fs.existsSync(authFilePath)) {
        throw new Error('VPN authentication file not found');
    }

    return new Promise((resolve, reject) => {
        console.log(`Connecting to VPN with config: ${configFilePath}`);
        currentVpnProcess = exec(`sudo /usr/sbin/openvpn --config "${configFilePath}" --auth-user-pass "${authFilePath}" --management 127.0.0.1 ${managementPort}`);

        currentVpnProcess.stdout.on('data', data => {
            console.log('stdout:', data);
            if (data.includes('Initialization Sequence Completed')) {
                console.log('VPN connected');
                resolve();
            }
        });

        currentVpnProcess.stderr.on('data', data => {
            console.error('stderr:', data);
            if (data.includes('Address already in use')) {
                managementPort += 1;  // Increment the port number and retry
                console.log(`Port in use, trying next port: ${managementPort}`);
                connectVpn(country).then(resolve).catch(reject);
            }
        });

        currentVpnProcess.on('close', code => {
            console.log('VPN process closed with code:', code);
            currentVpnProcess = null;
        });

        currentVpnProcess.on('error', err => {
            console.error('VPN process error:', err);
            reject(err);
        });
    });
}

function disconnectVpn() {
    return new Promise((resolve, reject) => {
        if (currentVpnProcess) {
            console.log('Disconnecting VPN');
            currentVpnProcess.on('exit', () => {
                console.log('VPN process exited');
                currentVpnProcess = null;
                resolve();
            });
            currentVpnProcess.on('error', (err) => {
                console.error('Error during VPN process termination:', err);
                reject(err);
            });
            killProcess(currentVpnProcess.pid).catch(err => {
                console.error('Error during VPN process kill:', err);
                reject(err);
            });
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
const { exec } = require('child_process');
const psTree = require('ps-tree');
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

let currentVpnProcess = null;
let managementPort = 1337;

function killProcess(pid, signal = 'SIGKILL') {
    return new Promise((resolve, reject) => {
        psTree(pid, (err, children) => {
            if (err) {
                return reject(err);
            }
            [pid].concat(children.map(p => p.PID)).forEach(tpid => {
                try {
                    process.kill(tpid, signal);
                } catch (ex) {
                    // ignore
                }
            });
            resolve();
        });
    });
}

async function connectVpn(country) {
    if (currentVpnProcess) {
        await disconnectVpn();
    }

    const configFilePath = path.join(vpnConfigDir, vpnConfigMap[country]);
    const authFilePath = path.join(vpnConfigDir, 'auth.txt');

    if (!fs.existsSync(authFilePath)) {
        throw new Error('VPN authentication file not found');
    }

    return new Promise((resolve, reject) => {
        console.log(`Connecting to VPN with config: ${configFilePath}`);
        currentVpnProcess = exec(`sudo /usr/sbin/openvpn --config "${configFilePath}" --auth-user-pass "${authFilePath}" --management 127.0.0.1 ${managementPort}`);

        currentVpnProcess.stdout.on('data', data => {
            console.log('stdout:', data);
            if (data.includes('Initialization Sequence Completed')) {
                console.log('VPN connected');
                resolve();
            }
        });

        currentVpnProcess.stderr.on('data', data => {
            console.error('stderr:', data);
            if (data.includes('Address already in use')) {
                managementPort += 1;  // Increment the port number and retry
                console.log(`Port in use, trying next port: ${managementPort}`);
                connectVpn(country).then(resolve).catch(reject);
            }
        });

        currentVpnProcess.on('close', code => {
            console.log('VPN process closed with code:', code);
            currentVpnProcess = null;
        });

        currentVpnProcess.on('error', err => {
            console.error('VPN process error:', err);
            reject(err);
        });
    });
}

function disconnectVpn() {
    return new Promise((resolve, reject) => {
        if (currentVpnProcess) {
            console.log('Disconnecting VPN');
            currentVpnProcess.on('exit', () => {
                console.log('VPN process exited');
                currentVpnProcess = null;
                resolve();
            });
            currentVpnProcess.on('error', (err) => {
                console.error('Error during VPN process termination:', err);
                reject(err);
            });
            killProcess(currentVpnProcess.pid).catch(err => {
                console.error('Error during VPN process kill:', err);
                reject(err);
            });
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
