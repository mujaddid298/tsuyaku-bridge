import { describe, expect, it } from "vitest";

function shouldAutoTranslatePage(params: {
  hostname: string;
  docLang?: string;
  bodySample?: string;
  autoTranslate: boolean;
  autoTranslateDomains: string[];
  neverTranslateDomains: string[];
  skipIfAlreadyTarget: boolean;
  targetLang: string;
}): boolean {
  const host = params.hostname.toLowerCase();

  // 1. Blacklist check
  if (
    params.neverTranslateDomains.some(
      (d) => host === d.toLowerCase() || host.endsWith("." + d.toLowerCase())
    )
  ) {
    return false;
  }

  // 2. Language match check
  if (params.skipIfAlreadyTarget) {
    const htmlLang = (params.docLang || "").toLowerCase().split("-")[0];
    const targetCode = (params.targetLang || "").toLowerCase().split("-")[0];
    if (htmlLang && targetCode && htmlLang === targetCode) {
      // If html lang says target, verify if body actually contains English text (e.g. AWS Skill Builder)
      const sample = (params.bodySample || "").toLowerCase();
      const englishWords = /\b(the|and|is|are|was|were|for|with|that|this|you|your|from|have|has|about|what|which|course|learning|project)\b/gi;
      const englishMatches = (sample.match(englishWords) || []).length;

      // If target is not English and sample has substantial English words, do NOT skip
      if (targetCode !== "en" && englishMatches >= 3) {
        // Proceed to auto-translate check
      } else {
        return false;
      }
    }
  }

  // 3. Whitelist or Global check
  const isAutoDomain = params.autoTranslateDomains.some(
    (d) => host === d.toLowerCase() || host.endsWith("." + d.toLowerCase())
  );

  return params.autoTranslate || isAutoDomain;
}

describe("Auto Translate Logic", () => {
  it("should not translate if domain is blacklisted", () => {
    const res = shouldAutoTranslatePage({
      hostname: "login.bank.com",
      autoTranslate: true,
      autoTranslateDomains: [],
      neverTranslateDomains: ["bank.com"],
      skipIfAlreadyTarget: true,
      targetLang: "id",
    });
    expect(res).toBe(false);
  });

  it("should not translate if page is genuinely already in target language", () => {
    const res = shouldAutoTranslatePage({
      hostname: "news.com",
      docLang: "id-ID",
      bodySample: "Berita terkini hari ini menyajikan informasi lengkap nasional dan internasional seputar ekonomi.",
      autoTranslate: true,
      autoTranslateDomains: [],
      neverTranslateDomains: [],
      skipIfAlreadyTarget: true,
      targetLang: "id",
    });
    expect(res).toBe(false);
  });

  it("should translate if page has html lang id but actual body is English (AWS Skill Builder case)", () => {
    const res = shouldAutoTranslatePage({
      hostname: "explore.skillbuilder.aws",
      docLang: "id",
      bodySample: "Is a machine learning solution appropriate for my problem? The planning a machine learning project course introduces requirements...",
      autoTranslate: true,
      autoTranslateDomains: [],
      neverTranslateDomains: [],
      skipIfAlreadyTarget: true,
      targetLang: "id",
    });
    expect(res).toBe(true);
  });

  it("should translate if page language differs", () => {
    const res = shouldAutoTranslatePage({
      hostname: "news.com",
      docLang: "en-US",
      autoTranslate: true,
      autoTranslateDomains: [],
      neverTranslateDomains: [],
      skipIfAlreadyTarget: true,
      targetLang: "id",
    });
    expect(res).toBe(true);
  });

  it("should translate if domain is in autoTranslateDomains even if global is off", () => {
    const res = shouldAutoTranslatePage({
      hostname: "en.wikipedia.org",
      docLang: "en",
      autoTranslate: false,
      autoTranslateDomains: ["wikipedia.org"],
      neverTranslateDomains: [],
      skipIfAlreadyTarget: true,
      targetLang: "id",
    });
    expect(res).toBe(true);
  });

  it("should not translate if domain is not in autoTranslateDomains and global is off", () => {
    const res = shouldAutoTranslatePage({
      hostname: "medium.com",
      docLang: "en",
      autoTranslate: false,
      autoTranslateDomains: ["wikipedia.org"],
      neverTranslateDomains: [],
      skipIfAlreadyTarget: true,
      targetLang: "id",
    });
    expect(res).toBe(false);
  });
});
