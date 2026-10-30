import { GlossaryEntry } from "../../shared/types";

export interface TranslateOptions {
  target: string;
  source?: string;
  glossary?: GlossaryEntry[];
  signal?: AbortSignal;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  message?: string;
}

export interface Provider {
  readonly id: string;
  translateBatch(texts: string[], opts: TranslateOptions): Promise<string[]>;
  translateOne(text: string, opts: TranslateOptions): Promise<string>;
  listModels?(): Promise<string[]>;
  testConnection?(): Promise<ConnectionTestResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public kind: "network" | "auth" | "rate_limit" | "server" | "parse" | "aborted",
    public status?: number,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
