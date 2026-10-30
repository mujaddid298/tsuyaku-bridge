import { useEffect, useState } from "preact/hooks";
import { getSettings, saveSettings } from "../background/settings";
import {
  BilingualIcon,
  BoltIcon,
  EndpointIcon,
  ReplaceIcon,
  RestoreIcon,
  SettingsIcon,
  TranslateIcon,
  TsuyakuLogo,
} from "../shared/icons";
import { SUPPORTED_LANGUAGES } from "../shared/languages";
import { Settings } from "../shared/types";

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pageStatus, setPageStatus] = useState<"idle" | "translating" | "translated">("idle");
  const [loading, setLoading] = useState(false);
  const [currentDomain, setCurrentDomain] = useState<string>("");

  useEffect(() => {
    getSettings().then((s) => setSettings(s));

    // Query active tab status & URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.url) {
        try {
          const url = new URL(activeTab.url);
          if (url.protocol.startsWith("http")) {
            setCurrentDomain(url.hostname);
          }
        } catch {
          // ignore invalid URLs
        }
      }

      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: "GET_STATUS" }, (res) => {
          if (chrome.runtime.lastError) return;
          if (res?.status) {
            setPageStatus(res.status);
          }
        });
      }
    });
  }, []);

  if (!settings) {
    return (
      <div style={{ padding: "30px", textAlign: "center" }}>
        <div class="nb-box nb-yellow" style={{ fontWeight: 700 }}>
          MEMUAT...
        </div>
      </div>
    );
  }

  const handleTranslate = async () => {
    setLoading(true);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(
        tab.id,
        {
          type: "TRANSLATE_PAGE",
          mode: settings.mode,
          target: settings.targetLang,
        },
        () => {
          setPageStatus("translating");
          setLoading(false);
        }
      );
    } else {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "RESTORE_PAGE" }, () => {
        setPageStatus("idle");
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeId = tabs[0]?.id;
      if (activeId) {
        chrome.tabs.sendMessage(activeId, { type: "SETTINGS_CHANGED", settings: updated });
      }
    });
  };

  const isDomainAuto = currentDomain
    ? (settings.autoTranslateDomains || []).includes(currentDomain)
    : false;

  const toggleDomainAutoTranslate = () => {
    if (!currentDomain) return;
    const currentList = settings.autoTranslateDomains || [];
    const newList = isDomainAuto
      ? currentList.filter((d) => d !== currentDomain)
      : [...currentList, currentDomain];
    updateSetting("autoTranslateDomains", newList);
  };

  const activeProfile =
    settings.profiles.find((p) => p.id === settings.activeProfileId) ||
    settings.profiles[0];

  return (
    <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {/* Tsuyaku Bridge Header */}
      <div
        class="nb-box nb-yellow"
        style={{
          padding: "12px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderRadius: "14px",
          boxShadow: "var(--nb-shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              border: "2.5px solid var(--nb-ink)",
              background: "var(--nb-paper)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "2px 2px 0 var(--nb-ink)",
              color: "#111111",
            }}
          >
            <TsuyakuLogo size={22} />
          </div>
          <div>
            <div
              class="nb-h3"
              style={{
                fontSize: "1.1rem",
                color: "#111111",
                letterSpacing: "-0.01em",
                textTransform: "uppercase",
              }}
            >
              Tsuyaku Bridge
            </div>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "rgba(17, 17, 17, 0.8)",
                letterSpacing: "0.01em",
              }}
            >
              Read anything. Understand everything
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {pageStatus === "translated" && (
            <span class="nb-badge nb-teal" style={{ fontSize: "0.65rem", padding: "3px 8px" }}>
              AKTIF
            </span>
          )}
          {pageStatus === "translating" && (
            <span class="nb-badge nb-orange" style={{ fontSize: "0.65rem", padding: "3px 8px" }}>
              PROSES
            </span>
          )}

          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            title="Buka Pengaturan Lengkap"
            class="nb-btn nb-btn-alt nb-btn-icon"
            style={{ width: "34px", height: "34px", borderRadius: "8px", padding: 0 }}
          >
            <SettingsIcon size={17} />
          </button>
        </div>
      </div>

      {/* Selectors Card */}
      <div class="nb-box" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px" }}>
        {/* Profile Selector */}
        <div class="nb-field">
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>PROFIL AI</span>
            {activeProfile?.model && (
              <span style={{ fontSize: "0.7rem", opacity: 0.75, textTransform: "none", fontWeight: 700 }}>
                {activeProfile.model}
              </span>
            )}
          </label>
          <select
            class="nb-select"
            value={settings.activeProfileId}
            onChange={(e) => updateSetting("activeProfileId", (e.target as HTMLSelectElement).value)}
          >
            {settings.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.model ? `(${p.model})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Target Language */}
        <div class="nb-field">
          <label>BAHASA TUJUAN</label>
          <select
            class="nb-select"
            value={settings.targetLang}
            onChange={(e) => updateSetting("targetLang", (e.target as HTMLSelectElement).value)}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Mode Render: Bilingual vs Replace */}
        <div class="nb-field">
          <label>TAMPILAN HASIL</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <button
              type="button"
              onClick={() => updateSetting("mode", "bilingual")}
              class={`nb-btn ${settings.mode === "bilingual" ? "nb-teal" : "nb-btn-alt"}`}
              style={{
                padding: "8px 10px",
                borderRadius: "10px",
                fontSize: "0.82rem",
                boxShadow: settings.mode === "bilingual" ? "var(--nb-shadow-xs)" : "1px 1px 0 var(--nb-ink)",
              }}
            >
              <BilingualIcon size={16} />
              <span>Bilingual</span>
            </button>
            <button
              type="button"
              onClick={() => updateSetting("mode", "replace")}
              class={`nb-btn ${settings.mode === "replace" ? "nb-teal" : "nb-btn-alt"}`}
              style={{
                padding: "8px 10px",
                borderRadius: "10px",
                fontSize: "0.82rem",
                boxShadow: settings.mode === "replace" ? "var(--nb-shadow-xs)" : "1px 1px 0 var(--nb-ink)",
              }}
            >
              <ReplaceIcon size={16} />
              <span>Ganti Teks</span>
            </button>
          </div>
        </div>
      </div>

      {/* Automation Box */}
      <div class="nb-box" style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <BoltIcon size={16} />
            <span style={{ fontFamily: "var(--nb-font-display)", fontSize: "0.82rem", letterSpacing: "0.02em" }}>
              OTOMATISASI
            </span>
          </div>
          <span class="nb-badge nb-pink" style={{ fontSize: "0.65rem", padding: "2px 7px" }}>
            SMART
          </span>
        </div>

        {/* Global Auto Translate */}
        <label class="nb-checkbox-row">
          <span>Otomatis semua situs</span>
          <input
            type="checkbox"
            class="nb-checkbox-custom"
            checked={settings.autoTranslate}
            onChange={(e) => updateSetting("autoTranslate", (e.target as HTMLInputElement).checked)}
          />
        </label>

        {/* Current Domain Toggle */}
        {currentDomain && (
          <label class="nb-checkbox-row" title={`Otomatis di ${currentDomain}`}>
            <span style={{ maxWidth: "230px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Otomatis di <b>{currentDomain}</b>
            </span>
            <input
              type="checkbox"
              class="nb-checkbox-custom"
              checked={isDomainAuto}
              onChange={toggleDomainAutoTranslate}
            />
          </label>
        )}

        {/* Floating Button Toggle */}
        <label class="nb-checkbox-row">
          <span>Tombol 1-klik di halaman</span>
          <input
            type="checkbox"
            class="nb-checkbox-custom"
            checked={settings.floatingButton !== false}
            onChange={(e) => updateSetting("floatingButton", (e.target as HTMLInputElement).checked)}
          />
        </label>
      </div>

      {/* Primary Action Button */}
      <div>
        {pageStatus === "translated" ? (
          <button
            onClick={handleRestore}
            disabled={loading}
            class="nb-btn nb-orange"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "14px",
              fontSize: "0.92rem",
              fontFamily: "var(--nb-font-display)",
              letterSpacing: "0.02em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <RestoreIcon size={18} />
            <span>TAMPILKAN TEKS ASLI</span>
          </button>
        ) : (
          <button
            onClick={handleTranslate}
            disabled={loading}
            class="nb-btn nb-yellow"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "14px",
              fontSize: "0.92rem",
              fontFamily: "var(--nb-font-display)",
              letterSpacing: "0.02em",
              background: loading ? "var(--nb-orange)" : "var(--nb-yellow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {pageStatus === "translating" ? (
              "MENERJEMAHKAN..."
            ) : (
              <>
                <TranslateIcon size={18} />
                <span>TERJEMAHKAN HALAMAN</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Target status indicator */}
      <div
        class="nb-box-sm"
        style={{
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          fontSize: "0.74rem",
          fontWeight: 700,
          background: "var(--nb-bg)",
          borderRadius: "10px",
          border: "2px dashed var(--nb-ink)",
          boxShadow: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <EndpointIcon size={14} />
        <span>Endpoint: {activeProfile.baseUrl || "Default Provider"}</span>
      </div>
    </div>
  );
}
