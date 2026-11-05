import { ProviderProfile } from "../../shared/types";
import { parseTranslations } from "./parse";
import { buildSystemPrompt } from "./prompt";
import { ConnectionTestResult, Provider, ProviderError, TranslateOptions } from "./types";

export class OpenAICompatProvider implements Provider {
  readonly id: string;

  constructor(private p: ProviderProfile) {
    this.id = p.id;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.p.extraHeaders,
    };
    if (this.p.apiKey) {
      h["Authorization"] = `Bearer ${this.p.apiKey}`;
    }
    return h;
  }

  private url(path: string): string {
    return this.p.baseUrl.replace(/\/+$/, "") + path;
  }

  async translateBatch(texts: string[], opts: TranslateOptions): Promise<string[]> {
    if (texts.length === 0) return [];

    const system = buildSystemPrompt(opts, opts.promptTemplate);
    const user = JSON.stringify(texts);

    const body: Record<string, unknown> = {
      model: this.p.model || "default",
      temperature: this.p.temperature,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };

    if (this.p.maxTokens) {
      body.max_tokens = this.p.maxTokens;
    }
    if (this.p.jsonMode === "on") {
      body.response_format = { type: "json_object" };
    }

    const res = await this.fetchWithTimeout(this.url("/chat/completions"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    const rawText = await res.text();
    const content = this.extractContent(rawText);
    return parseTranslations(content, texts.length);
  }

  private extractContent(rawText: string): string {
    const trimmed = rawText.trim();

    // Handle SSE (Server-Sent Events) streaming response e.g. "data: {...}"
    if (trimmed.startsWith("data:") || trimmed.includes("\ndata:")) {
      const lines = trimmed.split("\n");
      let accumulated = "";
      for (const line of lines) {
        const lineTrimmed = line.trim();
        if (!lineTrimmed.startsWith("data:")) continue;
        const dataContent = lineTrimmed.slice(5).trim();
        if (!dataContent || dataContent === "[DONE]") continue;
        try {
          const parsed = JSON.parse(dataContent);
          const chunk =
            parsed?.choices?.[0]?.delta?.content ??
            parsed?.choices?.[0]?.message?.content ??
            "";
          accumulated += chunk;
        } catch {
          // Skip unparseable chunk
        }
      }
      if (accumulated) {
        return accumulated;
      }
    }

    // Handle standard JSON response
    try {
      const json = JSON.parse(trimmed);
      return json?.choices?.[0]?.message?.content ?? "";
    } catch {
      throw new ProviderError(
        `Respon bukan format JSON yang valid: ${trimmed.slice(0, 120)}...`,
        "parse"
      );
    }
  }

  async translateOne(text: string, opts: TranslateOptions): Promise<string> {
    const [result] = await this.translateBatch([text], opts);
    return result || text;
  }

  async listModels(): Promise<string[]> {
    const res = await this.fetchWithTimeout(this.url("/models"), {
      method: "GET",
      headers: this.headers(),
    });
    const json = await res.json();
    return (json?.data ?? []).map((m: { id: string }) => m.id);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const t0 = performance.now();
    try {
      const out = await this.translateOne("Hello", { target: "id" });
      const latencyMs = Math.round(performance.now() - t0);
      return {
        ok: true,
        latencyMs,
        message: `Berhasil (${latencyMs}ms): "${out}"`,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - t0);
      return {
        ok: false,
        latencyMs,
        message: (err as Error).message,
      };
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.p.timeoutMs || 60000);

    if (init.signal) {
      init.signal.addEventListener("abort", () => ctrl.abort());
    }

    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      if (!res.ok) {
        throw await this.toProviderError(res);
      }
      return res;
    } catch (err: unknown) {
      if (err instanceof ProviderError) throw err;
      const error = err as Error;
      if (error.name === "AbortError") {
        throw new ProviderError("Permintaan timeout atau dibatalkan", "aborted");
      }
      throw new ProviderError(`Koneksi gagal: ${error.message}`, "network");
    } finally {
      clearTimeout(timer);
    }
  }

  private async toProviderError(res: Response): Promise<ProviderError> {
    let detail = "";
    try {
      const body = await res.text();
      detail = body.slice(0, 200);
    } catch {
      // ignore
    }

    const retryAfter = res.headers.get("Retry-After");
    const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;

    switch (res.status) {
      case 401:
      case 403:
        return new ProviderError(
          `Autentikasi gagal (HTTP ${res.status}): Cek API key atau CORS setting (OLLAMA_ORIGINS). ${detail}`,
          "auth",
          res.status
        );
      case 404:
        return new ProviderError(
          `Endpoint atau model tidak ditemukan (HTTP 404): ${detail}`,
          "server",
          404
        );
      case 429:
        return new ProviderError(
          `Rate limit terlampaui (HTTP 429). ${detail}`,
          "rate_limit",
          429,
          retryAfterMs
        );
      default:
        return new ProviderError(
          `Server mengembalikan error HTTP ${res.status}: ${detail}`,
          res.status >= 500 ? "server" : "network",
          res.status
        );
    }
  }
}
