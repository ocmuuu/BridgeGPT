import type { ChatgptComposer } from "./resolveComposer";

/** Phase: fill */
export function fillChatgptComposer(
  c: ChatgptComposer,
  text: string
): void {
  c.contentArea.innerHTML = text;
  c.inputElement.value = text;
}
