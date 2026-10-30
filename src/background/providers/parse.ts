import { ProviderError } from "./types";

export function parseTranslations(raw: string, expectedCount: number): string[] {
  let s = raw.trim();

  // Strip <think>...</think> (reasoning models)
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Find outermost JSON array
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new ProviderError(
      `Format output tidak valid (tidak ditemukan array JSON): ${s.slice(0, 100)}...`,
      "parse"
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(s.slice(start, end + 1));
  } catch (err) {
    throw new ProviderError(
      `Gagal mem-parse JSON array: ${(err as Error).message}`,
      "parse"
    );
  }

  if (!Array.isArray(parsed)) {
    throw new ProviderError("Hasil terjemahan bukan array JSON", "parse");
  }

  if (parsed.length !== expectedCount) {
    throw new ProviderError(
      `Jumlah hasil (${parsed.length}) tidak sesuai dengan input (${expectedCount})`,
      "parse"
    );
  }

  return parsed.map((item) => (typeof item === "string" ? item : String(item)));
}
