import { registerChatgptReceiveListener } from "./receive";
import { installChatgptSseFetchCapture } from "./waitCaptureSse";

/** Wire all ChatGPT page-world phases (install once per document). */
export function mountChatgptPageWorld(): void {
  installChatgptSseFetchCapture();
  registerChatgptReceiveListener();
}
