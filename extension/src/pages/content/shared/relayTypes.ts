export type AskQuestionPayload = {
  route: string;
  body: unknown;
  /**
   * Plain text for the web composer — always built on the relay
   * (`buildPromptForChatgptWeb` / `buildPromptForGeminiWeb`). The extension does not
   * duplicate that logic.
   */
  promptForChatgpt?: string;
  /** Which browser tab / provider should handle this (default chatgpt). */
  provider?: string;
};

export type QuestionAnswerPayload = Record<string, unknown>;
