/**
 * HTTP body when no extension socket has joined this api_key room (wrong key, offline, or not connected).
 */
export const EXTENSION_OFFLINE_MESSAGE =
  "BridgeGPT Chrome extension is not connected for this api_key on this relay. " +
  "Open the extension → Settings: confirm relay server URL, click Connect, and keep a signed-in " +
  "https://chatgpt.com, https://gemini.google.com, or https://grok.com tab open (match your API / X-Bridge-Provider). " +
  "If you regenerated api_key, update web chat / your client. Check the extension icon and Settings for connection status.";

export function openAiStyleExtensionOfflineJson(): Record<string, unknown> {
  return {
    error: {
      message: EXTENSION_OFFLINE_MESSAGE,
      type: "server_error",
      param: null,
      code: "service_unavailable",
    },
  };
}
