# Screenshot Service

This Node.js service captures screenshots of websites and returns them along with some basic SEO information. The service uses Puppeteer for browser automation and serves the screenshots via an Express server.

## Prerequisites

- Node.js (v12.x or later)
- npm (v6.x or later)

## Installation

1. Clone the repository:

    ```sh
    git clone https://github.com/yourusername/screenshot-service.git
    cd screenshot-service
    ```

2. Install the dependencies:

    ```sh
    npm install
    ```

3. Install Puppeteer dependencies:

    ```sh
    sudo apt-get update
    sudo apt-get install -y \
        gconf-service \
        libasound2 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgcc1 \
        libgconf-2-4 \
        libgdk-pixbuf2.0-0 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        ca-certificates \
        fonts-liberation \
        libappindicator1 \
        libnss3-dev \
        lsb-release \
        xdg-utils \
        wget
    ```

## Usage

1. Start the server:

    ```sh
    node index.js
    ```

2. The server will start running at `http://localhost:3000`.

## Endpoints

### GET /screenshot

Captures a screenshot of the specified URL and returns it along with some SEO information.

#### Query Parameters

- `url` (required): The URL of the website to capture.

#### Response

- `url`: The URL of the website.
- `ssl`: Whether the website uses SSL.
- `loadTime`: The time taken to load the website (in milliseconds).
- `seo`: An object containing SEO information:
  - `title`: The title of the website.
  - `description`: The meta description of the website.
  - `h1`: The content of the first `<h1>` tag on the website.
- `screenshotPath`: The path to the cached screenshot.
- `cached`: Whether the screenshot was returned from cache.

## Cloudflare Apache 2 setup

1. Apache Configuration
Locate the Apache Configuration File:
Bitnami Apache configuration files are typically located at /opt/bitnami/apache2/conf/. The primary configuration file is often named bitnami.conf.
Edit the Apache Configuration:

Open the configuration file in your preferred text editor:
```
sudo nano /opt/bitnami/apache2/conf/bitnami/bitnami.conf
```

Add the Proxy Configuration:
Update the file to include the following configuration, ensuring it properly proxies requests to your Node.js application:

```
<VirtualHost _default_:80>
    ServerName snap.linkmaster.io
    DocumentRoot "/opt/bitnami/apache2/htdocs"
    RewriteEngine On
    RewriteCond %{HTTPS} !=on
    RewriteRule ^/(.*) https://%{SERVER_NAME}/$1 [R,L]
</VirtualHost>

<VirtualHost _default_:443>
    ServerName snap.linkmaster.io
    SSLEngine on
    SSLCertificateFile "/opt/bitnami/apache2/conf/bitnami/certs/server.crt"
    SSLCertificateKeyFile "/opt/bitnami/apache2/conf/bitnami/certs/server.key"

    ProxyRequests Off
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    <Proxy *>
        Order allow,deny
        Allow from all
    </Proxy>

    # Add CORS headers
    <Location />
        Header set Access-Control-Allow-Origin "*"
        Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Header set Access-Control-Allow-Headers "Origin, Content-Type, Accept"
    </Location>
</VirtualHost>
```
Save and Exit:
Save the changes and exit the editor (Ctrl + O to save, Ctrl + X to exit in nano).

Enable the Required Apache Modules
Ensure that the necessary Apache modules are enabled. You might need to enable proxy, proxy_http, and headers modules.

2. Enable Modules:

Open the main Apache configuration file:
```
sudo nano /opt/bitnami/apache2/conf/httpd.conf
```

Ensure the following lines are present and uncommented:

```
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule headers_module modules/mod_headers.so
```
Save the changes and exit the editor.

Restart Apache
To apply the changes, restart the Apache service. On a Bitnami stack, you usually use the ctlscript.sh to manage services.

```
sudo /opt/bitnami/ctlscript.sh restart apache
```
## Cloudflare Configuration

Ensure that your Cloudflare settings are correctly configured to allow HTTPS traffic. Specifically, check the SSL/TLS settings and ensure that the mode is set to "Full" or "Full (strict)".

Testing
Test your endpoint to ensure it is working correctly:

```
curl "https://snap.linkmaster.io/screenshot?refresh=true&url=https://apple.com"
```
Troubleshooting
If there are issues, check the logs for your Node.js application and Apache:

Node.js logs: If using PM2, you can check the logs using:

```
pm2 logs screenshot-service
```
Apache logs: Usually found in /opt/bitnami/apache2/logs/:

```
sudo tail -f /opt/bitnami/apache2/logs/error_log
sudo tail -f /opt/bitnami/apache2/logs/access_log
```
By following these steps, you should be able to ensure that your Node.js application is accessible via port 3000 through Apache on a Bitnami stack and that Cloudflare is properly configured to handle HTTPS traffic.
