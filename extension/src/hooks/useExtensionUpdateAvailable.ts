import { useEffect, useState } from "react";
import { EXTENSION_UPDATE_AVAILABLE_KEY } from "@src/config";

/** Relay `GET /version` is newer than this install (see background `checkExtensionVersionAgainstRelay`). */
export function useExtensionUpdateAvailable(): {
  pending: boolean;
  serverVersion: string | null;
} {
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      chrome.storage.local.get(EXTENSION_UPDATE_AVAILABLE_KEY, (r) => {
        if (chrome.runtime.lastError) return;
        const v = r[EXTENSION_UPDATE_AVAILABLE_KEY];
        setServerVersion(typeof v === "string" && v.length > 0 ? v : null);
      });
    };
    read();
    const onChanged: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local" || !(EXTENSION_UPDATE_AVAILABLE_KEY in changes)) {
        return;
      }
      read();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  return { pending: serverVersion !== null, serverVersion };
}
