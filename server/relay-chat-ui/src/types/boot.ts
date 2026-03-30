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
  /** Same-origin URL for `server/public/images/logo.png` (favicon + UI). */
  logoUrl: string;
};
