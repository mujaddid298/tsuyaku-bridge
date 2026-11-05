import { ToBackground, ToContent } from "../shared/messages";
import { getProvider } from "./providers/registry";
import { translationQueue } from "./queue";
import { getSettings, stripSecrets } from "./settings";

// Setup context menus and commands on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tx-selection",
    title: "Terjemahkan “%s”",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "tx-page",
    title: "Terjemahkan halaman ini",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: "tx-restore",
    title: "Tampilkan teks asli",
    contexts: ["page"],
  });
});

// Handle context menus
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === "tx-selection" && info.selectionText) {
    const settings = await getSettings();
    const provider = getProvider(settings);
    try {
      const translated = await provider.translateOne(info.selectionText, {
        target: settings.targetLang,
        source: settings.sourceLang,
        glossary: settings.glossary,
        promptTemplate: settings.systemPromptTemplate,
      });

      chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_SELECTION_RESULT",
        original: info.selectionText,
        translated,
      } as ToContent);
    } catch (err) {
      chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_SELECTION_RESULT",
        original: info.selectionText,
        translated: `Gagal menerjemahkan: ${(err as Error).message}`,
      } as ToContent);
    }
  } else if (info.menuItemId === "tx-page") {
    const settings = await getSettings();
    chrome.tabs.sendMessage(tab.id, {
      type: "TRANSLATE_PAGE",
      mode: settings.mode,
      target: settings.targetLang,
    } as ToContent);
  } else if (info.menuItemId === "tx-restore") {
    chrome.tabs.sendMessage(tab.id, {
      type: "RESTORE_PAGE",
    } as ToContent);
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!activeTab?.id) return;

  const settings = await getSettings();
  if (command === "translate-page") {
    chrome.tabs.sendMessage(activeTab.id, {
      type: "TRANSLATE_PAGE",
      mode: settings.mode,
      target: settings.targetLang,
    } as ToContent);
  }
});

// One-off message router
chrome.runtime.onMessage.addListener((msg: ToBackground, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  (async () => {
    try {
      const settings = await getSettings();
      switch (msg.type) {
        case "TEST_CONNECTION": {
          const provider = getProvider(settings, msg.profileId);
          const result = await provider.testConnection?.();
          sendResponse(result);
          break;
        }
        case "LIST_MODELS": {
          const provider = getProvider(settings, msg.profileId);
          const models = await provider.listModels?.();
          sendResponse(models);
          break;
        }
        case "GET_SETTINGS_PUBLIC": {
          sendResponse(stripSecrets(settings));
          break;
        }
        case "TRANSLATE_TEXT": {
          const provider = getProvider(settings);
          const res = await provider.translateOne(msg.text, {
            target: msg.targetLang || settings.targetLang,
            source: settings.sourceLang,
            glossary: settings.glossary,
            promptTemplate: settings.systemPromptTemplate,
          });
          sendResponse({ text: res });
          break;
        }
        case "BROADCAST_TRANSLATE": {
          const tabId = sender.tab?.id;
          if (tabId) {
            chrome.tabs.sendMessage(tabId, {
              type: "TRANSLATE_PAGE",
              mode: msg.mode || settings.mode,
              target: msg.target || settings.targetLang,
            });
          }
          sendResponse({ ok: true });
          break;
        }
        case "BROADCAST_RESTORE": {
          const tabId = sender.tab?.id;
          if (tabId) {
            chrome.tabs.sendMessage(tabId, {
              type: "RESTORE_PAGE",
            });
          }
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (err) {
      sendResponse({ error: (err as Error).message });
    }
  })();

  return true; // asynchronous response
});

// Long-lived port connection for translation jobs
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "tx-job") return;

  port.onMessage.addListener(async (msg: ToBackground) => {
    const settings = await getSettings();
    translationQueue.handle(port, msg, settings);
  });

  port.onDisconnect.addListener(() => {
    translationQueue.cancelByPort(port);
  });
});
