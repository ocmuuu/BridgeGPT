# BridgeGPT — browser extension

This directory contains the **BridgeGPT** Chrome / Firefox extension. It works together with the relay in the repo root under `server/`.

Full setup, API examples, and relay discovery routes: [**README.md**](../README.md) at the repository root.

## Install (Chrome) without building

1. Open **[BridgeGPT Releases](https://github.com/ocmuuu/BridgeGPT/releases)**.
2. Download **`bridgegpt-chrome-<tag>.zip`** for the release you want.
3. Open **`chrome://extensions`** → enable **Developer mode** → **drag the zip** onto the page to install.  
   If that fails, unzip and use **Load unpacked** on the folder that contains `manifest.json`.

Maintainers: the zip is produced by [.github/workflows/release-chrome-extension.yml](../.github/workflows/release-chrome-extension.yml) when you push a **`v*`** tag.

## Sites

Content scripts and page helpers target **https://chatgpt.com**, **https://chat.openai.com**, **https://gemini.google.com**, and **https://grok.com** (see `manifest.json`).

## Build from source

From the monorepo root: `npm run build:chrome` or `npm run dev:chrome`. Output: **`extension/dist_chrome/`**.

Firefox: `npm run build:firefox` / `npm run dev:firefox` → **`extension/dist_firefox/`**.
