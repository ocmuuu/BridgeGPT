import { createRoot } from "react-dom/client";
import "./style.css";
import { resolveContentProvider } from "./webProviders/registry";

console.log("[BridgeGPT] content script", location.href);

const div = document.createElement("div");
div.id = "__root";
document.body.appendChild(div);

const rootContainer = document.querySelector("#__root");
if (!rootContainer) throw new Error("Can't find Content root element");

const spec = resolveContentProvider(location.href);
if (!spec) {
  console.warn("[BridgeGPT] Unsupported host; no provider:", location.href);
} else {
  const root = createRoot(rootContainer);
  const Bridge = spec.Component;
  root.render(<Bridge />);
}
