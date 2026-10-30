import { BackgroundEvent, ToBackground, ToContent } from "../shared/messages";
import { RenderMode, Settings } from "../shared/types";
import { CollectedUnit, collectTranslationUnits } from "./dom-walker";
import { floatingButton } from "./floating-button";
import { overlay } from "./overlay";
import { renderTranslation, restoreAll } from "./renderer";

let currentJobPort: chrome.runtime.Port | null = null;
let currentMode: RenderMode = "bilingual";
let activeUnitsMap = new Map<string, CollectedUnit>();
let pageState: "idle" | "translating" | "translated" = "idle";
let currentSettings: Settings | null = null;

function setPageState(state: "idle" | "translating" | "translated", progress?: { done: number; total: number }) {
  pageState = state;
  floatingButton.setState(state, progress);
}

function startPageTranslation(mode: RenderMode, _targetLang: string) {
  if (pageState === "translating") return;

  currentMode = mode;
  const units = collectTranslationUnits(document.body);
  if (units.length === 0) return;

  activeUnitsMap.clear();
  for (const u of units) {
    activeUnitsMap.set(u.unit.id, u);
  }

  setPageState("translating", { done: 0, total: units.length });
  overlay.showProgress(0, units.length);

  // Connect long-lived port to background
  if (currentJobPort) {
    currentJobPort.disconnect();
  }
  currentJobPort = chrome.runtime.connect({ name: "tx-job" });

  const jobId = `job_${Date.now()}`;

  currentJobPort.onMessage.addListener((event: BackgroundEvent) => {
    switch (event.type) {
      case "BATCH_RESULT": {
        for (const res of event.results) {
          const collected = activeUnitsMap.get(res.id);
          if (collected && collected.element.isConnected) {
            renderTranslation(
              collected.element,
              res.text,
              collected.codecMap,
              currentMode
            );
          }
        }
        break;
      }
      case "PROGRESS": {
        overlay.showProgress(event.done, event.total);
        if (event.done >= event.total) {
          setPageState("translated");
        } else {
          setPageState("translating", { done: event.done, total: event.total });
        }
        break;
      }
      case "BATCH_ERROR": {
        console.warn("[AI Translator] Batch error:", event.error);
        break;
      }
    }
  });

  currentJobPort.onDisconnect.addListener(() => {
    currentJobPort = null;
  });

  // Send batch request
  const msg: ToBackground = {
    type: "TRANSLATE_BATCH",
    jobId,
    priority: 0,
    units: units.map((u) => u.unit),
  };
  currentJobPort.postMessage(msg);
}

function restoreOriginal() {
  if (currentJobPort) {
    currentJobPort.disconnect();
    currentJobPort = null;
  }
  restoreAll(document.body);
  overlay.hideProgress();
  setPageState("idle");
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

  // Check if page language is already target language
  if (settings.skipIfAlreadyTarget) {
    const htmlLang = (document.documentElement.lang || "").toLowerCase().split("-")[0];
    const targetCode = (settings.targetLang || "").toLowerCase().split("-")[0];
    if (htmlLang && targetCode && htmlLang === targetCode) {
      return;
    }
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

function initContentScript() {
  chrome.runtime.sendMessage({ type: "GET_SETTINGS_PUBLIC" }, (settings: Settings) => {
    if (chrome.runtime.lastError || !settings) return;
    currentSettings = settings;

    // Initialize 1-click floating button if enabled
    if (settings.floatingButton !== false) {
      floatingButton.init({
        onTranslate: () => {
          const mode = currentSettings?.mode || "bilingual";
          const target = currentSettings?.targetLang || "id";
          startPageTranslation(mode, target);
        },
        onRestore: () => {
          restoreOriginal();
        },
      });
    }

    // Evaluate auto-translate
    checkAndAutoTranslate(settings);
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
      if (msg.settings.floatingButton === false) {
        floatingButton.destroy();
      } else {
        floatingButton.init({
          onTranslate: () => {
            const mode = currentSettings?.mode || "bilingual";
            const target = currentSettings?.targetLang || "id";
            startPageTranslation(mode, target);
          },
          onRestore: () => {
            restoreOriginal();
          },
        });
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
