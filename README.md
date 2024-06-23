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

#### Example Request

```sh
curl "http://localhost:3000/screenshot?url=https://example.com"
