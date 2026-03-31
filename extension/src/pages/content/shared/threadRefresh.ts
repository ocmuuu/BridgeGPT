import type { WebProviderId } from "../../../webProviders/config";
import { WEB_PROVIDERS } from "../../../webProviders/config";

/** After this many user turns in the thread, same-tab navigation to startUrl (fresh chat). */
export const RELAY_THREAD_MAX_USER_TURNS = 8;

export function countUserTurnsInThread(provider: WebProviderId): number {
  if (provider === "gemini") {
    return document.querySelectorAll("div.conversation-container").length;
  }
  const byRole = document.querySelectorAll(
    '[data-message-author-role="user"]'
  ).length;
  return byRole;
}

/**
 * Call from the content script after a non-empty assistant reply was sent to the relay.
 * Uses a short delay so navigation does not race with in-flight extension messaging.
 */
export function scheduleFreshChatIfTurnLimitReached(
  provider: WebProviderId,
  hadNonEmptyAssistant: boolean
): void {
  if (!hadNonEmptyAssistant) return;
  const n = countUserTurnsInThread(provider);
  if (n < RELAY_THREAD_MAX_USER_TURNS) return;
  const url = WEB_PROVIDERS[provider].startUrl;
  window.setTimeout(() => {
    window.location.assign(url);
  }, 400);
}
