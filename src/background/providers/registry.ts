import { Settings } from "../../shared/types";
import { OpenAICompatProvider } from "./openai-compat";
import { Provider } from "./types";

export function getProvider(settings: Settings, profileId?: string): Provider {
  const targetId = profileId || settings.activeProfileId;
  const profile =
    settings.profiles.find((p) => p.id === targetId) || settings.profiles[0];

  if (!profile) {
    throw new Error(`Profil provider ${targetId} tidak ditemukan`);
  }

  return new OpenAICompatProvider(profile);
}
