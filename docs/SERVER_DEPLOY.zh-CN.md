# BridgeGPT 中继服务端 — 部署说明

本文说明如何在自有 Linux 主机（VPS、家庭服务器等）上部署 **`server/` 下的 Node 中继**。中继是 **常驻进程**：Express HTTP + **Socket.IO** + 静态资源，**不适合**直接按无服务器函数方式部署（例如典型 Vercel Serverless），除非大幅改架构。

完整英文版：[SERVER_DEPLOY.md](./SERVER_DEPLOY.md)

---

## 1. 部署内容

| 部分 | 作用 |
|------|------|
| `node server/dist/index.js` | OpenAI / Gemini 风格 HTTP API、Socket.IO |
| `server/public/` | 静态资源（如网页聊天 UI：`/public/relay-chat/`） |
| 浏览器扩展 | 通过 WebSocket 保持连接；构建时需设置 **`VITE_API_BASE_URL`** 指向本中继 |

**工作目录：** 进程应在 **`server/` 目录**下运行（或保证 `server/public` 与 `server/dist` 的相对关系与构建结果一致）。下文 PM2、systemd 均以克隆目录下的 **`…/BridgeGPT/server`** 为例。

---

## 2. 环境要求

- **Node.js ≥ 18**（建议 LTS）
- **npm**，且在**仓库根目录**执行 `npm install`（monorepo workspaces）
- 开放 **HTTP/WebSocket** 端口（默认 **3456**）；公网建议 **HTTPS**
- 反向代理需支持 **WebSocket 升级**（Socket.IO）

---

## 3. 克隆与安装

```bash
git clone https://github.com/ocmuuu/BridgeGPT.git
cd BridgeGPT
npm install
```

---

## 4. 构建

在**仓库根目录**：

```bash
npm run build -w @bridgegpt/server
```

会编译 TS 到 `server/dist/`，并把网页聊天前端构建到 `server/public/relay-chat/`。

---

## 5. 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `3456` | 监听端口 |
| `NODE_ENV` | — | 生产环境建议 `production` |
| `RELAY_REQUEST_TIMEOUT_MS` | `150000` | 等待扩展返回完成的最长时间（毫秒） |

---

## 6. 运行方式

**前台调试：**

```bash
cd server
node dist/index.js
```

**仓库根目录：**

```bash
npm run start -w @bridgegpt/server
```

**健康检查：**

```bash
curl -sS http://127.0.0.1:3456/health
```

### PM2（多 Node 服务时常用）

仓库提供 **`server/ecosystem.config.cjs`**。在**仓库根目录**：

```bash
npm run build -w @bridgegpt/server
pm2 start server/ecosystem.config.cjs
pm2 save
```

请修改配置里的 **`name`**（避免与其它应用重名）和 **`PORT`**。保持 **`instances: 1`**、**`fork`**，不要用 **cluster** 多实例跑 Socket.IO（无共享状态会出问题）。

### systemd

将 **`WorkingDirectory`** 设为克隆路径下的 **`server`**，`ExecStart` 指向 `node dist/index.js`。示例见英文文档 [SERVER_DEPLOY.md](./SERVER_DEPLOY.md) 第六节。

---

## 7. HTTPS 与反向代理

公网务必使用 **HTTPS**。在 **nginx** 或 **Caddy** 上终止 TLS，反代到 **`http://127.0.0.1:3456`**（或你设置的 `PORT`）。

**BridgeGPT 对反代的要求**

- **WebSocket**：Socket.IO 需要正确的 `Upgrade` / `Connection`（nginx 用下文 **`map`**；Caddy 的 `reverse_proxy` 默认会处理）。
- **超时**：中继会等待扩展返回（默认约 **150s**），反代的 `read_timeout` / `proxy_read_timeout` 建议 **≥ 300s**。
- **SSE（流式）**：可在 nginx 关闭 **`proxy_buffering`**，减少流式响应被缓存。

将示例里的 **`relay.example.com`** 换成你的域名。若反代与本机同源，中继只需监听 **127.0.0.1** 更安全。

**防火墙**：反代占用 **443** 时，一般**不要**再把 **3456** 暴露到公网。

### 7.1 nginx

在 **`http { }`** 里 **`map` 只定义一次**（若已有 WebSocket 用的 `map`，合并即可）。站点文件可放在 `/etc/nginx/sites-available/` 并软链到 `sites-enabled/`。

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name relay.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name relay.example.com;

    ssl_certificate     /etc/letsencrypt/live/relay.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/relay.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3456;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;

        proxy_connect_timeout  60s;
        proxy_send_timeout    300s;
        proxy_read_timeout    300s;

        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }
}
```

证书（Let’s Encrypt）示例：

```bash
sudo certbot --nginx -d relay.example.com
sudo nginx -t && sudo systemctl reload nginx
```

### 7.2 Caddy v2

**`Caddyfile`** 最小示例（DNS 指向本机且开放 80/443 时，Caddy 会自动申请/续期证书）：

```caddyfile
relay.example.com {
    reverse_proxy 127.0.0.1:3456 {
        # 长耗时请求（需 Caddy 2.6+）
        transport http {
            read_timeout 300s
            write_timeout 300s
        }
    }
}
```

**Caddy &lt; 2.6** 请去掉 `transport http { ... }`，只保留 `reverse_proxy 127.0.0.1:3456`；若仍超时，建议升级 Caddy。

校验并重载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 7.3 自检

| 项 | 说明 |
|----|------|
| 本机中继 | `curl -sS http://127.0.0.1:3456/health` |
| 经 HTTPS | `curl -sS https://relay.example.com/health` |
| 扩展 / Socket.IO | 若 HTTP 正常但连接异常，检查 nginx 的 **`map` + `Connection`** |

更详细的英文说明与上下文见 [SERVER_DEPLOY.md](./SERVER_DEPLOY.md) 第七节。

---

## 8. 扩展

```bash
VITE_API_BASE_URL=https://你的域名/ npm run build:chrome
```

URL 末尾必须有 **`/`**。详见主 [README](../README.zh-CN.md)。

---

## 9. 升级

```bash
cd BridgeGPT
git pull
npm install
npm run build -w @bridgegpt/server
pm2 restart bridgegpt-relay
```

---

## 10. 与「纯 Serverless」的区别

中继依赖 **长连接** 和 **连接期状态**，典型 Serverless 仅适合短请求。更稳妥的是 **VPS、Railway、Render、Fly.io** 等能跑 **常驻 Node 进程** 的环境。

---

## 相关链接

- 主 README：[README.zh-CN.md](../README.zh-CN.md)
- PM2 示例：[server/ecosystem.config.cjs](../server/ecosystem.config.cjs)
