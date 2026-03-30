export type AskQuestionPayload = {
  route: string;
  body: unknown;
  /** Server-built single user turn (field name kept for relay compatibility). */
  promptForChatgpt?: string;
  /** Which browser tab / provider should handle this (default chatgpt). */
  provider?: string;
};

export type QuestionAnswerPayload = Record<string, unknown>;
