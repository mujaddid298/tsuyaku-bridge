import { BackgroundEvent, ToBackground, ToContent } from "../shared/messages";
import { RenderMode, Settings } from "../shared/types";
import { CollectedUnit, collectTranslationUnits } from "./dom-walker";
import { floatingButton } from "./floating-button";
import { overlay } from "./overlay";
import { renderTranslation, restoreAll } from "./renderer";

const isTopFrame = window === window.top;
let currentJobPort: chrome.runtime.Port | null = null;
let currentMode: RenderMode = "bilingual";
let activeUnitsMap = new Map<string, CollectedUnit>();
let pageState: "idle" | "translating" | "translated" = "idle";
let currentSettings: Settings | null = null;
let lastUrl = window.location.href;
let mutationObserver: MutationObserver | null = null;
let mutationDebounceTimer: number | null = null;

function setPageState(state: "idle" | "translating" | "translated", progress?: { done: number; total: number }) {
  pageState = state;
  if (isTopFrame) {
    floatingButton.setState(state, progress);
  }
}

function handlePortMessage(event: BackgroundEvent) {
  switch (event.type) {
    case "BATCH_RESULT": {
      for (const res of event.results) {
        const collected = activeUnitsMap.get(res.id);
        if (collected && collected.element.isConnected) {
          renderTranslation(
            collected.element,
            res.text,
            collected.codecMap,
            currentMode,
            currentSettings?.ui?.bilingualStyle || "dim"
          );
        }
      }
      break;
    }
    case "PROGRESS": {
      if (isTopFrame) {
        overlay.showProgress(event.done, event.total);
      }
      if (event.done >= event.total) {
        setPageState("translated");
        setupMutationObserver();
      } else {
        setPageState("translating", { done: event.done, total: event.total });
      }
      break;
    }
    case "BATCH_ERROR": {
      console.warn("[Tsuyaku Bridge] Batch error:", event.error);
      break;
    }
  }
}

function ensureJobPort(): chrome.runtime.Port {
  if (currentJobPort) {
    return currentJobPort;
  }
  const port = chrome.runtime.connect({ name: "tx-job" });
  port.onMessage.addListener(handlePortMessage);
  port.onDisconnect.addListener(() => {
    currentJobPort = null;
  });
  currentJobPort = port;
  return port;
}

function startPageTranslation(mode: RenderMode, _targetLang: string) {
  if (pageState === "translating") return;

  currentMode = mode;
  const units = collectTranslationUnits(document.body);
  if (units.length === 0) {
    setPageState("translated");
    setupMutationObserver();
    return;
  }

  activeUnitsMap.clear();
  for (const u of units) {
    activeUnitsMap.set(u.unit.id, u);
  }

  setPageState("translating", { done: 0, total: units.length });
  if (isTopFrame) {
    overlay.showProgress(0, units.length);
  }

  if (currentJobPort) {
    currentJobPort.disconnect();
    currentJobPort = null;
  }
  const port = ensureJobPort();
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const msg: ToBackground = {
    type: "TRANSLATE_BATCH",
    jobId,
    priority: 0,
    units: units.map((u) => u.unit),
  };
  port.postMessage(msg);
}

function translateDynamicUnits() {
  if (pageState !== "translated" || !currentSettings) return;

  const newUnits = collectTranslationUnits(document.body);
  if (newUnits.length === 0) return;

  for (const u of newUnits) {
    activeUnitsMap.set(u.unit.id, u);
  }

  const port = ensureJobPort();
  const jobId = `dyn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const msg: ToBackground = {
    type: "TRANSLATE_BATCH",
    jobId,
    priority: 1,
    units: newUnits.map((u) => u.unit),
  };
  port.postMessage(msg);
}

function setupMutationObserver() {
  if (mutationObserver || !document.body) return;

  mutationObserver = new MutationObserver((mutations) => {
    if (pageState !== "translated") return;

    let shouldScan = false;
    for (const m of mutations) {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        for (let i = 0; i < m.addedNodes.length; i++) {
          const node = m.addedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            if (
              !el.classList?.contains("tx-trans") &&
              el.id !== "ai-translator-floating-host" &&
              el.id !== "tx-overlay-root"
            ) {
              shouldScan = true;
              break;
            }
          }
        }
      } else if (m.type === "attributes") {
        shouldScan = true;
      }
      if (shouldScan) break;
    }

    if (!shouldScan) return;

    if (mutationDebounceTimer) {
      window.clearTimeout(mutationDebounceTimer);
    }
    mutationDebounceTimer = window.setTimeout(() => {
      translateDynamicUnits();
    }, 500);
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden", "open"],
  });
}

function stopMutationObserver() {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (mutationDebounceTimer) {
    window.clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = null;
  }
}

function restoreOriginal() {
  stopMutationObserver();

  if (currentJobPort) {
    currentJobPort.disconnect();
    currentJobPort = null;
  }
  restoreAll(document.body);
  if (isTopFrame) {
    overlay.hideProgress();
  }
  setPageState("idle");
}

export function shouldSkipBecauseAlreadyTarget(targetLang: string, skipIfAlreadyTarget: boolean): boolean {
  if (!skipIfAlreadyTarget) return false;

  const htmlLang = (document.documentElement.lang || "").toLowerCase().split("-")[0];
  const targetCode = (targetLang || "").toLowerCase().split("-")[0];

  if (!htmlLang || !targetCode || htmlLang !== targetCode) {
    return false;
  }

  // If html lang matches target, verify if the body content is actually in the target language.
  // Sites like AWS Skill Builder, Microsoft, and Coursera often set <html lang="id"> based on user locale,
  // while the course body remains completely in English.
  const sample = (document.body?.innerText || "").slice(0, 3000).toLowerCase();
  if (!sample || sample.trim().length < 40) {
    return true;
  }

  const englishWords = /\b(the|and|is|are|was|were|for|with|that|this|you|your|from|have|has|about|what|which|course|learning|project)\b/gi;
  const englishMatches = (sample.match(englishWords) || []).length;

  if (targetCode !== "en" && englishMatches >= 3) {
    // Content actually contains substantial English text; do not skip!
    return false;
  }

  return true;
}

function checkAndAutoTranslate(settings: Settings) {
  const hostname = window.location.hostname.toLowerCase();
  if (!hostname) return;

  // Check blacklist
  if (
    settings.neverTranslateDomains &&
    settings.neverTranslateDomains.some(
      (d) => hostname === d.toLowerCase() || hostname.endsWith("." + d.toLowerCase())
    )
  ) {
    return;
  }

  // Check if page language is genuinely the target language
  if (shouldSkipBecauseAlreadyTarget(settings.targetLang, settings.skipIfAlreadyTarget)) {
    return;
  }

  // Check if global auto-translate is on, or domain is in autoTranslateDomains
  const isAutoDomain =
    settings.autoTranslateDomains &&
    settings.autoTranslateDomains.some(
      (d) => hostname === d.toLowerCase() || hostname.endsWith("." + d.toLowerCase())
    );

  const shouldAuto = settings.autoTranslate || isAutoDomain;
  if (shouldAuto) {
    const delay = settings.autoTranslateDelayMs || 800;
    setTimeout(() => {
      if (pageState === "idle") {
        startPageTranslation(settings.mode, settings.targetLang);
      }
    }, delay);
  }
}

function handleNavigationChange() {
  const currentUrl = window.location.href;
  if (currentUrl === lastUrl) return;
  lastUrl = currentUrl;

  // Reset page state for the new route
  stopMutationObserver();
  if (currentJobPort) {
    currentJobPort.disconnect();
    currentJobPort = null;
  }
  activeUnitsMap.clear();
  setPageState("idle");
  if (isTopFrame) {
    overlay.hideProgress();
  }

  // Give the SPA router a moment to mount the new route view, then check auto-translate
  if (currentSettings) {
    const delay = Math.max(600, currentSettings.autoTranslateDelayMs || 800);
    setTimeout(() => {
      if (currentSettings && pageState === "idle") {
        checkAndAutoTranslate(currentSettings);
      }
    }, delay);
  }
}

function setupSpaNavigation() {
  const origPushState = history.pushState;
  history.pushState = function (...args) {
    const res = origPushState.apply(this, args);
    handleNavigationChange();
    return res;
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const res = origReplaceState.apply(this, args);
    handleNavigationChange();
    return res;
  };

  window.addEventListener("popstate", handleNavigationChange);
  window.addEventListener("hashchange", handleNavigationChange);

  // Interval check as fallback for unconventional client routing
  setInterval(handleNavigationChange, 1000);
}

function initContentScript() {
  chrome.runtime.sendMessage({ type: "GET_SETTINGS_PUBLIC" }, (settings: Settings) => {
    if (chrome.runtime.lastError || !settings) return;
    currentSettings = settings;

    // Initialize 1-click floating button only on the top frame
    if (isTopFrame && settings.floatingButton !== false) {
      floatingButton.init({
        onTranslate: () => {
          const mode = currentSettings?.mode || "bilingual";
          const target = currentSettings?.targetLang || "id";
          startPageTranslation(mode, target);
          // Broadcast to any subframes (e.g. course iframes)
          chrome.runtime.sendMessage({ type: "BROADCAST_TRANSLATE", mode, target });
        },
        onRestore: () => {
          restoreOriginal();
          chrome.runtime.sendMessage({ type: "BROADCAST_RESTORE" });
        },
      });
    }

    // Evaluate auto-translate
    checkAndAutoTranslate(settings);

    // Setup SPA navigation listener
    setupSpaNavigation();
  });
}

// Listen for messages from background / popup
chrome.runtime.onMessage.addListener((msg: ToContent | { type: "SETTINGS_CHANGED"; settings: Settings }, _sender, sendResponse) => {
  switch (msg.type) {
    case "TRANSLATE_PAGE":
      startPageTranslation(msg.mode, msg.target);
      sendResponse({ status: "started" });
      break;
    case "RESTORE_PAGE":
      restoreOriginal();
      sendResponse({ status: "restored" });
      break;
    case "SHOW_SELECTION_RESULT":
      overlay.showSelectionTooltip(msg.original, msg.translated);
      sendResponse({ status: "shown" });
      break;
    case "GET_STATUS":
      sendResponse({ status: pageState, mode: currentMode });
      break;
    case "CANCEL":
      restoreOriginal();
      sendResponse({ status: "cancelled" });
      break;
    case "SETTINGS_CHANGED":
      currentSettings = msg.settings;
      if (isTopFrame) {
        if (msg.settings.floatingButton === false) {
          floatingButton.destroy();
        } else {
          floatingButton.init({
            onTranslate: () => {
              const mode = currentSettings?.mode || "bilingual";
              const target = currentSettings?.targetLang || "id";
              startPageTranslation(mode, target);
              chrome.runtime.sendMessage({ type: "BROADCAST_TRANSLATE", mode, target });
            },
            onRestore: () => {
              restoreOriginal();
              chrome.runtime.sendMessage({ type: "BROADCAST_RESTORE" });
            },
          });
        }
      }
      sendResponse({ status: "updated" });
      break;
  }
  return true;
});

// Run init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContentScript);
} else {
  initContentScript();
}
