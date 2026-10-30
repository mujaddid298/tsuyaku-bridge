export type RenderMode = "bilingual" | "replace";

export interface ProviderProfile {
  id: string; // uuid
  name: string; // e.g. "9router (lokal)"
  kind: "openai-compat" | "chrome-builtin";
  baseUrl: string; // e.g. "http://localhost:20128/v1"
  apiKey?: string; // optional for local server
  model: string; // model/combo name
  temperature: number; // default 0.1
  maxTokens?: number;
  maxConcurrency: number; // default 2 (local) / 4 (cloud)
  batchMaxItems: number; // default 15
  batchMaxChars: number; // default 4000
  timeoutMs: number; // default 60000
  extraHeaders?: Record<string, string>;
  jsonMode: "auto" | "on" | "off";
  outputFormat?: "json" | "numbered"; // optional fallback format
}

export interface GlossaryEntry {
  source: string;
  target: string;
  note?: string;
}

export interface Settings {
  schemaVersion: number;
  activeProfileId: string;
  fallbackProfileId?: string;
  profiles: ProviderProfile[];

  targetLang: string; // "id"
  sourceLang: "auto" | string;
  mode: RenderMode;
  systemPromptTemplate: string; // empty = use default prompt
  glossary: GlossaryEntry[];

  autoTranslate: boolean; // global auto translate for all pages
  autoTranslateDomains: string[];
  neverTranslateDomains: string[];
  skipIfAlreadyTarget: boolean; // default true
  floatingButton: boolean; // floating 1-click button on page
  autoTranslateDelayMs: number; // delay before auto-translating (e.g. 800ms)
  translateOnScroll: boolean; // lazy viewport, default true
  maxCharsPerPage: number; // safety limit, default 60000

  cache: {
    enabled: boolean;
    ttlDays: number;
    maxEntries: number;
  };
  ui: {
    language: "id" | "en";
    bilingualStyle: "dim" | "underline" | "box";
  };
}

export interface TranslationUnit {
  id: string; // unique per page, e.g. "u17"
  text: string; // encoded with placeholders
  hash?: string;
}

export interface TranslationResult {
  id: string;
  text: string;
}
