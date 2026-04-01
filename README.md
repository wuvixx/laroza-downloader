# Laroza Video Downloader

A lightweight **Node.js** utility to search and download videos from Laroza. This tool supports downloading the latest posts directly from the homepage or fetching specific videos via a provided link. It handles encrypted streams using `mp4decrypt` and `N_m3u8DL-RE`.

## ✨ Features

  * **Latest Posts:** Automatically fetch and search through the most recent videos on the Laroza homepage.
  * **Direct Download:** Provide a specific Laroza link to download the video immediately.
  * **High Quality:** Leverages `N_m3u8DL-RE` for stable HLS/DASH stream downloading.

-----

## 🛠 Prerequisites

This script acts as a wrapper for several powerful media tools. You **must** have the following installed and added to your system's **PATH**:

| Tool | Purpose | Source |
| :--- | :--- | :--- |
| **Node.js** | Runtime environment | [nodejs.org](https://nodejs.org/) |
| **FFmpeg** | Video muxing and processing | [ffmpeg.org](https://ffmpeg.org/download.html) |
| **N\_m3u8DL-RE** | Dash/HLS stream downloader | [GitHub Releases](https://github.com/nilaoda/N_m3u8DL-RE/releases) |
| **mp4decrypt** | Decrypting DRM protected content | [Bento4 Downloads](https://www.bento4.com/downloads/) |

> **Tip:** Verify your installation by running `ffmpeg -version`, `N_m3u8DL-RE --version`, and `mp4decrypt` in your terminal.

-----

## 🚀 Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/wuvixx/laroza-downloader.git
    cd laroza-downloader
    ```

2.  **Install Node.js dependencies:**

    ```bash
    npm install
    ```

-----

## 📖 Usage

Run the script using Node:

```bash
node index.js
```

### Options:

1.  **Search Latest Posts:** The script will scrape the main page and list the most recent videos for you to choose from.
2.  **Direct Link:** Paste a Laroza video URL (e.g., `https://laroza.now/video...`) and the script will attempt to locate the manifest and begin the download.

-----

## ⚖️ Disclaimer

This tool is for **educational purposes only**. I do not encourage or condone the unauthorized downloading of copyrighted material. Users are responsible for complying with the website's Terms of Service and local copyright laws.

-----

## 📜 License

This project is licensed under the [MIT License](https://www.google.com/search?q=LICENSE).

-----

### Pro-Tip for your GitHub Repo:

Since you mentioned using **regex** for your unpacker and scraping, make sure your code handles potential errors gracefully if the website layout changes. You might also want to add a `.gitignore` to prevent your `node_modules` and any test `.mp4` files from being uploaded\!
