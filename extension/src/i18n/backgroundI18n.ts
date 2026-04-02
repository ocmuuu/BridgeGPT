/**
 * Service worker / background user strings via `chrome.i18n` (`_locales` in the
 * built extension). Locale follows the browser UI language when a matching
 * folder exists (e.g. `zh_CN`).
 */
export function tBackground(
  messageName: string,
  substitutions?: string | string[]
): string {
  const s = chrome.i18n.getMessage(messageName, substitutions);
  return s.length > 0 ? s : messageName;
}
