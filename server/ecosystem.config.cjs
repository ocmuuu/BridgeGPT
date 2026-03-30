/**
 * PM2 — run from repo root: `pm2 start server/ecosystem.config.cjs`
 * Or from server/: `pm2 start ecosystem.config.cjs`
 * Use a unique `name` if you already run many Node apps on the host.
 */
module.exports = {
  apps: [
    {
      name: "bridgegpt-relay",
      cwd: __dirname,
      script: "dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 3456,
      },
    },
  ],
};
