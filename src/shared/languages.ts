export interface LanguageOption {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "id", name: "Bahasa Indonesia" },
  { code: "en", name: "English" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ru", name: "Russian" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "tr", name: "Turkish" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "ms", name: "Bahasa Melayu" },
  { code: "hi", name: "Hindi" },
];

export function getLanguageName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find(
    (l) => l.code.toLowerCase() === code.toLowerCase()
  );
  return found ? found.name : code;
}
