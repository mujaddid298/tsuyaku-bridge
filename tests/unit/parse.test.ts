import { describe, expect, it } from "vitest";
import { parseTranslations } from "../../src/background/providers/parse";
import { ProviderError } from "../../src/background/providers/types";

describe("parseTranslations", () => {
  it("should parse clean JSON array correctly", () => {
    const input = '["Halo dunia", "Selamat pagi"]';
    const result = parseTranslations(input, 2);
    expect(result).toEqual(["Halo dunia", "Selamat pagi"]);
  });

  it("should strip markdown code fences", () => {
    const input = '```json\n["Satu", "Dua"]\n```';
    const result = parseTranslations(input, 2);
    expect(result).toEqual(["Satu", "Dua"]);
  });

  it("should strip reasoning <think> tags", () => {
    const input =
      '<think>Let me translate these two sentences</think>```json\n["A", "B"]\n```';
    const result = parseTranslations(input, 2);
    expect(result).toEqual(["A", "B"]);
  });

  it("should throw error if count does not match expected", () => {
    const input = '["Hanya satu"]';
    expect(() => parseTranslations(input, 2)).toThrowError(ProviderError);
  });

  it("should throw error if output is not a JSON array", () => {
    const input = '{"text": "Bukan array"}';
    expect(() => parseTranslations(input, 1)).toThrowError(ProviderError);
  });
});
