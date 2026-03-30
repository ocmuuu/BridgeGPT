# BridgeGPT relay — server deployment guide

This document is a **step-by-step** guide to running the **Node relay** (`server/`) on your own Linux host (VPS, homelab, etc.). The relay is a **long-lived process**: Express HTTP + **Socket.IO** + static files. It is **not** a good fit for serverless-only platforms (e.g. Vercel) without a major architecture change.

---

## 1. What you are deploying

| Piece | Role |
|--------|------|
| `node server/dist/index.js` | HTTP API (OpenAI- and Gemini-shaped routes), Socket.IO server |
| `server/public/` | Static assets (e.g. relay web UI under `/public/relay-chat/`) |
| Browser extension | Must stay connected via WebSocket; build with `VITE_API_BASE_URL` pointing at this relay |

**Working directory:** The process should run with **`server/` as the current working directory** (or ensure `server/public` and `server/dist` stay next to each other as after a normal build). PM2 and systemd examples below use `WorkingDirectory=/path/to/repo/server`.

---

## 2. Requirements

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **≥ 18** (LTS recommended) |
| **npm** | Workspace install from **repository root** |
| **OS** | Linux examples below (Debian/Ubuntu-style); macOS is fine for dev |
| **Network** | TCP port for HTTP/WebSocket (default **3456**); **TLS** recommended on the public internet |
| **Reverse proxy** (optional) | **nginx**, Caddy, etc. — must forward **WebSocket** upgrades for Socket.IO |

---

## 3. Clone and install

```bash
git clone https://github.com/ocmuuu/BridgeGPT.git
cd BridgeGPT
npm install
```

Install must run at the **monorepo root** so workspaces (`server`, `extension`) resolve correctly.

---

## 4. Build the relay

From the **repository root**:

```bash
npm run build -w @bridgegpt/server
```

This runs the **Vite** build for the relay web UI into `server/public/relay-chat/` and **TypeScript** compile to `server/dist/`.

Sanity checks:

```bash
test -f server/dist/index.js && test -f server/public/relay-chat/relay-app.js && echo OK
```

---

## 5. Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | HTTP listen port |
| `NODE_ENV` | — | Set to `production` in production |
| `RELAY_REQUEST_TIMEOUT_MS` | `150000` | Max wait (ms) for the extension to return a completion |

Example:

```bash
export PORT=3456
export NODE_ENV=production
export RELAY_REQUEST_TIMEOUT_MS=180000
```

---

## 6. Run the relay

### 6.1 One-off (foreground)

```bash
cd server
node dist/index.js
```

Verify:

```bash
curl -sS http://127.0.0.1:3456/health
# {"ok":true}
```

### 6.2 npm script (from repo root)

```bash
npm run start -w @bridgegpt/server
```

This runs `node dist/index.js` with cwd resolved for the workspace (still uses `server/` context).

### 6.3 PM2 (recommended for multiple Node apps)

The repo includes **`server/ecosystem.config.cjs`**.

From **repository root**:

```bash
npm run build -w @bridgegpt/server
pm2 start server/ecosystem.config.cjs
pm2 save
```

Edit `server/ecosystem.config.cjs` to change **`name`** (avoid clashes) and **`PORT`**. Keep **`instances: 1`** and **`exec_mode: "fork"`** — Socket.IO is not safe to run in **cluster** mode without shared state.

Useful commands:

```bash
pm2 logs bridgegpt-relay
pm2 restart bridgegpt-relay
```

If you already use `pm2 startup`, run **`pm2 save`** after adding this app (no need to run `startup` again).

### 6.4 systemd (alternative)

Run as a dedicated user and set **`WorkingDirectory`** to the **`server`** directory inside your clone.

```ini
[Unit]
Description=BridgeGPT relay
After=network.target

[Service]
Type=simple
User=bridgegpt
WorkingDirectory=/opt/BridgeGPT/server
Environment=NODE_ENV=production
Environment=PORT=3456
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Adjust **`User`**, **`WorkingDirectory`**, and **`ExecStart`** (absolute path to `node` if needed).

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bridgegpt-relay.service
```

---

## 7. TLS and reverse proxy (public internet)

Expose **HTTPS** to clients. Terminate TLS at **nginx** (or Caddy) and proxy to `http://127.0.0.1:3456`.

**nginx** example — WebSocket headers are required for Socket.IO:

```nginx
server {
    listen 443 ssl http2;
    server_name relay.example.com;

    # ssl_certificate ... ssl_certificate_key ...

    location / {
        proxy_pass http://127.0.0.1:3456;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Issue certificates with **Let’s Encrypt** (e.g. `certbot` with the nginx plugin).

**Firewall:** If nginx listens on 443, you often **do not** expose port **3456** publicly — only localhost.

---

## 8. Browser extension

Build the extension with your public relay URL (**trailing slash**):

```bash
VITE_API_BASE_URL=https://relay.example.com/ npm run build:chrome
```

Install that build in the browser that stays logged in to **chatgpt.com** / **gemini.google.com** as needed. See the main [README](../README.md) for API and security notes.

---

## 9. Upgrading

```bash
cd BridgeGPT
git pull
npm install
npm run build -w @bridgegpt/server
pm2 restart bridgegpt-relay
# or: sudo systemctl restart bridgegpt-relay.service
```

---

## 10. Troubleshooting

| Symptom | Check |
|---------|--------|
| `curl /health` fails | Process running? Correct `PORT`? Firewall? |
| Extension never connects | `VITE_API_BASE_URL` matches the URL you use? HTTPS vs HTTP mismatch? |
| HTTP works, Socket.IO fails | Reverse proxy missing **Upgrade** / **Connection** headers |
| 503 / no extension | Extension **Connect** in Settings; same **api_key** as HTTP client |
| Missing web UI assets | Re-run **`npm run build -w @bridgegpt/server`**; ensure `server/public/relay-chat/` exists next to `dist/` |

More detail: [README — Troubleshooting](../README.md#troubleshooting).

---

## 11. Hosting model (why not “serverless only”)

The relay keeps **in-memory** (and Socket.IO) state tied to connected extension tabs. **Serverless** platforms that only run short-lived functions are a poor match unless you redesign storage and transport. Prefer a **VPS**, **Railway**, **Render**, **Fly.io**, or any host that runs a **persistent Node** process.

---

## Related links

- Main README: [README.md](../README.md)
- PM2 config: [server/ecosystem.config.cjs](../server/ecosystem.config.cjs)
- 中文部署说明: [SERVER_DEPLOY.zh-CN.md](./SERVER_DEPLOY.zh-CN.md)
