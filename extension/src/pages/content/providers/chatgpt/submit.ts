import { postChatgptRunAskFailure } from "./emitFailure";

/** Phase: submit — deferred click so React/ChatGPT picks up input state. */
export function scheduleSubmitChatgpt(startedAt: string): void {
  window.setTimeout(() => {
    const submitButton = document.querySelector(
      "#composer-submit-button"
    ) as HTMLButtonElement | null;
    if (!submitButton) {
      postChatgptRunAskFailure("no_submit_button", startedAt);
      return;
    }
    submitButton.click();
  }, 100);
}
