import { installChatgptSseFetchCapture } from "./capture";
import { registerChatgptReceiveListener } from "./receive";

/** Wire all ChatGPT page-world phases (install once per document). */
export function mountChatgptPageWorld(): void {
  installChatgptSseFetchCapture();
  registerChatgptReceiveListener();
}
