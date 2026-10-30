import { describe, expect, it } from "vitest";

function shouldAutoTranslatePage(params: {
  hostname: string;
  docLang?: string;
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
      return false;
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

  it("should not translate if page is already in target language", () => {
    const res = shouldAutoTranslatePage({
      hostname: "news.com",
      docLang: "id-ID",
      autoTranslate: true,
      autoTranslateDomains: [],
      neverTranslateDomains: [],
      skipIfAlreadyTarget: true,
      targetLang: "id",
    });
    expect(res).toBe(false);
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
