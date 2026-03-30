import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const serverRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.join(serverRoot, "relay-chat-ui"),
  base: "/public/relay-chat/",
  build: {
    outDir: path.join(serverRoot, "public", "relay-chat"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(serverRoot, "relay-chat-ui", "index.html"),
      output: {
        inlineDynamicImports: true,
        entryFileNames: "relay-app.js",
        assetFileNames: "relay-app[extname]",
      },
    },
  },
});
