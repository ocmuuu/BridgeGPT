/**
 * Browser-only relay chat UI shell (served at GET /). api_key from URL once, then cookie; never embedded by the server.
 */

import { RELAY_CHAT_SHELL_MARKUP } from "./relayChatShell.markup.js";

export const RELAY_API_KEY_COOKIE = "bridgegpt_api_key";

/** URL prefix for `server/public` (must match `express.static` in `index.ts`). */
export const RELAY_PUBLIC_URL_PREFIX = "/public";

const RELAY_CHAT_STATIC_BASE = `${RELAY_PUBLIC_URL_PREFIX}/relay-chat`;
const RELAY_LOGO_URL = `${RELAY_PUBLIC_URL_PREFIX}/images/logo.png`;

function relayChatBootScriptJson(payload: object): string {
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

export type RelayChatBoot = {
  initialUserMessage: string;
  /** OpenAI-compat chat model when backend is openai */
  model: string;
  /** openai / grok → /v1/chat/completions; gemini → /v1beta/models/…:streamGenerateContent */
  backend: "openai" | "gemini" | "grok";
  /** Path segment for Gemini (label only; real model is the site UI) */
  geminiModel: string;
  /** Placeholder when backend is grok (real model is the grok.com session). */
  grokModel: string;
};

export function relayChatShellHtml(boot: RelayChatBoot): string {
  const bootFull = {
    cookieName: RELAY_API_KEY_COOKIE,
    sseBlockSep: "\n\n",
    sseLineSep: "\n",
    openaiModels: ["gpt-5", "gpt-5-mini"],
    geminiModels: [
      "gemini-3.1-flash",
      "gemini-3.1-pro",
      "gemini-3.1",
    ],
    grokModels: ["grok-4.2"],
    ...boot,
    logoUrl: RELAY_LOGO_URL,
  };
  const bootJson = relayChatBootScriptJson(bootFull);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>BridgeGPT</title>
  <link rel="icon" href="${RELAY_LOGO_URL}" type="image/png" sizes="any"/>
  <link rel="apple-touch-icon" href="${RELAY_LOGO_URL}"/>
  <link rel="stylesheet" href="${RELAY_CHAT_STATIC_BASE}/relay-app.css"/>
</head>
<body>
${RELAY_CHAT_SHELL_MARKUP}
  <script type="application/json" id="relay-chat-boot">${bootJson}</script>
  <script type="module" src="${RELAY_CHAT_STATIC_BASE}/relay-app.js"></script>
</body>
</html>`;
}
