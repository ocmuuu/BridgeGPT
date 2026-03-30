import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import type { RelayChatBoot } from "./types/boot";
import "./styles/index.css";

function readBoot(): RelayChatBoot {
  const el = document.getElementById("relay-chat-boot");
  if (!el?.textContent?.trim()) {
    throw new Error("Missing #relay-chat-boot");
  }
  return JSON.parse(el.textContent.trim()) as RelayChatBoot;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root");

createRoot(rootEl).render(
  <StrictMode>
    <App boot={readBoot()} />
  </StrictMode>
);
