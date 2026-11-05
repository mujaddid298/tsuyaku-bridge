import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "__MSG_extName__",
  description: "__MSG_extDescription__",
  version: "0.1.0",
  default_locale: "id",
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "__MSG_actionTitle__",
  },
  options_page: "src/options/index.html",
  background: {
    service_worker: "src/background/index.ts",
    scripts: ["src/background/index.ts"],
    type: "module",
  },
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content/index.ts"],
      css: ["src/content/styles.css"],
      run_at: "document_idle",
      all_frames: true,
      match_about_blank: true,
    },
  ],
  permissions: ["storage", "activeTab", "contextMenus", "scripting"],
  host_permissions: ["http://localhost/*", "http://127.0.0.1/*", "https://*/*", "http://*/*"],
  commands: {
    "translate-page": {
      suggested_key: { default: "Alt+T" },
      description: "Terjemahkan / kembalikan halaman",
    },
    "translate-selection": {
      suggested_key: { default: "Alt+S" },
      description: "Terjemahkan teks terpilih",
    },
  },
  browser_specific_settings: {
    gecko: {
      id: "ai-page-translator@antigravity",
      strict_min_version: "109.0",
    },
  },
});
