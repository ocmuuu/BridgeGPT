/** Phase: resolve_composer — ChatGPT composer (hidden input + contenteditable host). */

export type ChatgptComposer = {
  inputElement: HTMLInputElement;
  contentArea: HTMLDivElement;
};

export function resolveChatgptComposer(): ChatgptComposer | null {
  const inputElement = document.querySelector(
    '[name="prompt-textarea"]'
  ) as HTMLInputElement | null;
  const contentArea = document.querySelector(
    "#prompt-textarea"
  ) as HTMLDivElement | null;
  if (!inputElement || !contentArea) return null;
  return { inputElement, contentArea };
}
