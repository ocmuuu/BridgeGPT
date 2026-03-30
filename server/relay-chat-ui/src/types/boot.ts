export type RelayChatBoot = {
  cookieName: string;
  sseBlockSep: string;
  sseLineSep: string;
  openaiModels: string[];
  geminiModels: string[];
  initialUserMessage: string;
  model: string;
  backend: "openai" | "gemini";
  geminiModel: string;
};
