import { buildCacheKey, sha256 } from "../shared/hash";
import { BackgroundEvent, SerializedError, ToBackground } from "../shared/messages";
import { Settings, TranslationResult, TranslationUnit } from "../shared/types";
import { getCached, setCached } from "./cache";
import { getProvider } from "./providers/registry";
import { Provider, ProviderError } from "./providers/types";

interface QueuedJob {
  port: chrome.runtime.Port;
  jobId: string;
  priority: 0 | 1 | 2;
  units: TranslationUnit[];
  settings: Settings;
  aborted: boolean;
  abortController: AbortController;
}

class TranslationQueue {
  private activeJobs = new Map<string, QueuedJob>();

  cancelByPort(port: chrome.runtime.Port) {
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.port === port) {
        job.aborted = true;
        job.abortController.abort();
        this.activeJobs.delete(jobId);
      }
    }
  }

  cancelJob(jobId: string) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.aborted = true;
      job.abortController.abort();
      this.activeJobs.delete(jobId);
    }
  }

  async handle(port: chrome.runtime.Port, msg: ToBackground, settings: Settings) {
    if (msg.type === "CANCEL_JOB") {
      this.cancelJob(msg.jobId);
      return;
    }

    if (msg.type !== "TRANSLATE_BATCH") return;

    const { jobId, priority, units } = msg;
    if (!units || units.length === 0) return;

    const job: QueuedJob = {
      port,
      jobId,
      priority,
      units,
      settings,
      aborted: false,
      abortController: new AbortController(),
    };

    this.activeJobs.set(jobId, job);
    await this.processJob(job);
    this.activeJobs.delete(jobId);
  }

  private async processJob(job: QueuedJob) {
    const { port, jobId, units, settings, abortController } = job;
    const provider = getProvider(settings);
    const activeProfile =
      settings.profiles.find((p) => p.id === settings.activeProfileId) ||
      settings.profiles[0];

    const toTranslate: TranslationUnit[] = [];
    const cachedResults: TranslationResult[] = [];
    const promptVersion = settings.systemPromptTemplate || "v2_natural";
    const glossaryHash = settings.glossary.length
      ? await sha256(JSON.stringify(settings.glossary))
      : "noglossary";

    // 1. Separate cache hits and misses
    for (const unit of units) {
      if (job.aborted) return;
      const rawKey = buildCacheKey(
        activeProfile.model,
        settings.targetLang,
        promptVersion,
        glossaryHash,
        unit.text
      );
      const hash = await sha256(rawKey);
      unit.hash = hash;

      if (settings.cache.enabled) {
        const cached = await getCached(hash, settings.cache.ttlDays);
        if (cached !== null) {
          cachedResults.push({ id: unit.id, text: cached });
          continue;
        }
      }
      toTranslate.push(unit);
    }

    // Send immediate cache hits
    if (cachedResults.length > 0) {
      this.sendEvent(port, {
        type: "BATCH_RESULT",
        jobId,
        results: cachedResults,
      });
      this.sendEvent(port, {
        type: "PROGRESS",
        jobId,
        done: cachedResults.length,
        total: units.length,
        cached: cachedResults.length,
      });
    }

    if (toTranslate.length === 0) return;

    // 2. Chunk into batches
    const batches = this.chunkUnits(
      toTranslate,
      activeProfile.batchMaxItems || 15,
      activeProfile.batchMaxChars || 4000
    );

    let completedCount = cachedResults.length;

    for (const batch of batches) {
      if (job.aborted) break;

      try {
        const results = await this.translateBatchWithRetry(
          provider,
          batch,
          settings,
          abortController.signal
        );

        if (job.aborted) break;

        // Save to cache
        if (settings.cache.enabled) {
          for (const res of results) {
            const unit = batch.find((u) => u.id === res.id);
            if (unit?.hash) {
              await setCached(unit.hash, res.text);
            }
          }
        }

        completedCount += results.length;

        this.sendEvent(port, {
          type: "BATCH_RESULT",
          jobId,
          results,
        });

        this.sendEvent(port, {
          type: "PROGRESS",
          jobId,
          done: completedCount,
          total: units.length,
          cached: cachedResults.length,
        });
      } catch (err) {
        if (job.aborted) break;
        const pErr = err as ProviderError;
        const serialized: SerializedError = {
          message: pErr.message,
          kind: pErr.kind || "server",
          status: pErr.status,
        };

        this.sendEvent(port, {
          type: "BATCH_ERROR",
          jobId,
          unitIds: batch.map((u) => u.id),
          error: serialized,
        });
      }
    }
  }

  private chunkUnits(
    units: TranslationUnit[],
    maxItems: number,
    maxChars: number
  ): TranslationUnit[][] {
    const batches: TranslationUnit[][] = [];
    let currentBatch: TranslationUnit[] = [];
    let currentCharCount = 0;

    for (const unit of units) {
      const unitLen = unit.text.length;
      if (
        currentBatch.length >= maxItems ||
        (currentBatch.length > 0 && currentCharCount + unitLen > maxChars)
      ) {
        batches.push(currentBatch);
        currentBatch = [];
        currentCharCount = 0;
      }
      currentBatch.push(unit);
      currentCharCount += unitLen;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    return batches;
  }

  private async translateBatchWithRetry(
    provider: Provider,
    units: TranslationUnit[],
    settings: Settings,
    signal: AbortSignal,
    attempt = 1
  ): Promise<TranslationResult[]> {
    const texts = units.map((u) => u.text);

    try {
      const translated = await provider.translateBatch(texts, {
        target: settings.targetLang,
        source: settings.sourceLang,
        glossary: settings.glossary,
        promptTemplate: settings.systemPromptTemplate,
        signal,
      });

      return units.map((u, i) => ({
        id: u.id,
        text: translated[i] || u.text,
      }));
    } catch (err) {
      const pErr = err as ProviderError;

      // If parse error and batch has more than 1 item, split batch in half
      if (pErr.kind === "parse" && units.length > 1) {
        const mid = Math.ceil(units.length / 2);
        const left = await this.translateBatchWithRetry(
          provider,
          units.slice(0, mid),
          settings,
          signal,
          1
        );
        const right = await this.translateBatchWithRetry(
          provider,
          units.slice(mid),
          settings,
          signal,
          1
        );
        return [...left, ...right];
      }

      // Exponential backoff for temporary server / rate-limit errors
      if (
        attempt < 3 &&
        (pErr.kind === "server" || pErr.kind === "rate_limit" || pErr.kind === "network")
      ) {
        const backoffMs =
          pErr.retryAfterMs ||
          Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10000);
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.translateBatchWithRetry(
          provider,
          units,
          settings,
          signal,
          attempt + 1
        );
      }

      throw pErr;
    }
  }

  private sendEvent(port: chrome.runtime.Port, event: BackgroundEvent) {
    try {
      port.postMessage(event);
    } catch {
      // Port disconnected
    }
  }
}

export const translationQueue = new TranslationQueue();
