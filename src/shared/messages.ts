import { RenderMode, TranslationResult, TranslationUnit } from "./types";

export interface SerializedError {
  message: string;
  kind: "network" | "auth" | "rate_limit" | "server" | "parse" | "aborted";
  status?: number;
}

export type ToContent =
  | { type: "TRANSLATE_PAGE"; mode: RenderMode; target: string }
  | { type: "RESTORE_PAGE" }
  | { type: "SET_MODE"; mode: RenderMode }
  | {
      type: "SHOW_SELECTION_RESULT";
      original: string;
      translated: string;
      x?: number;
      y?: number;
    }
  | { type: "CANCEL" }
  | { type: "GET_STATUS" };

export type ToBackground =
  | {
      type: "TRANSLATE_BATCH";
      jobId: string;
      priority: 0 | 1 | 2;
      units: TranslationUnit[];
    }
  | { type: "CANCEL_JOB"; jobId: string }
  | { type: "TRANSLATE_TEXT"; text: string; targetLang?: string }
  | { type: "TEST_CONNECTION"; profileId: string }
  | { type: "LIST_MODELS"; profileId: string }
  | { type: "GET_SETTINGS_PUBLIC" }
  | { type: "BROADCAST_TRANSLATE"; mode: RenderMode; target: string }
  | { type: "BROADCAST_RESTORE" };

export type BackgroundEvent =
  | { type: "BATCH_RESULT"; jobId: string; results: TranslationResult[] }
  | {
      type: "BATCH_ERROR";
      jobId: string;
      unitIds: string[];
      error: SerializedError;
    }
  | {
      type: "PROGRESS";
      jobId: string;
      done: number;
      total: number;
      cached: number;
    };
