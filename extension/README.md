# BridgeGPT — browser extension

This directory contains the **BridgeGPT** Chrome / Firefox extension. It works together with the relay in the repo root under `server/`.

Full setup, install steps, and API examples: [**README.md**](../README.md) at the repository root.

**Sites**: content scripts and page helpers target **https://chatgpt.com**, **https://chat.openai.com**, and **https://gemini.google.com** (see `manifest.json`).

**Build**: from the monorepo root run `npm run build:chrome` or `npm run dev:chrome`. Output: `extension/dist_chrome/`.
