import { DEFAULT_SETTINGS } from "../shared/constants";
import { Settings } from "../shared/types";

const SETTINGS_KEY = "tx_settings";

export async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get([SETTINGS_KEY], (res) => {
      if (!res[SETTINGS_KEY]) {
        // First run: save and return defaults
        saveSettings(DEFAULT_SETTINGS);
        resolve(DEFAULT_SETTINGS);
      } else {
        const stored = res[SETTINGS_KEY] as Settings;
        // Merge with defaults in case new fields were added
        const merged: Settings = {
          ...DEFAULT_SETTINGS,
          ...stored,
          cache: { ...DEFAULT_SETTINGS.cache, ...stored.cache },
          ui: { ...DEFAULT_SETTINGS.ui, ...stored.ui },
        };
        resolve(merged);
      }
    });
  });
}

export async function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
      resolve();
    });
  });
}

export function stripSecrets(settings: Settings): Settings {
  return {
    ...settings,
    profiles: settings.profiles.map((p) => ({
      ...p,
      apiKey: p.apiKey ? "********" : "",
    })),
  };
}
