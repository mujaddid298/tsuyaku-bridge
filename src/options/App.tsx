import { useEffect, useState } from "preact/hooks";
import { clearCache, getCacheStats } from "../background/cache";
import { getSettings, saveSettings } from "../background/settings";
import {
  BoltIcon,
  CheckIcon,
  CpuIcon,
  CrossIcon,
  DatabaseIcon,
  DownloadIcon,
  InfoIcon,
  PlusIcon,
  PromptIcon,
  TrashIcon,
  TsuyakuLogo,
} from "../shared/icons";
import { ProviderProfile, Settings } from "../shared/types";

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<"profiles" | "automation" | "prompt" | "cache" | "about">("profiles");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [cacheStats, setCacheStats] = useState<{ count: number; totalChars: number }>({ count: 0, totalChars: 0 });
  const [savedNotice, setSavedNotice] = useState(false);

  const [newAutoDomain, setNewAutoDomain] = useState("");
  const [newNeverDomain, setNewNeverDomain] = useState("");

  useEffect(() => {
    getSettings().then((s) => setSettings(s));
    getCacheStats().then((st) => setCacheStats(st));
  }, []);

  if (!settings) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div class="nb-box nb-yellow" style={{ display: "inline-block", fontWeight: 700 }}>
          MEMUAT PENGATURAN...
        </div>
      </div>
    );
  }

  const activeProfile =
    settings.profiles.find((p) => p.id === settings.activeProfileId) ||
    settings.profiles[0];

  const handleSave = async (updated: Settings) => {
    setSettings(updated);
    await saveSettings(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const updateActiveProfile = (partial: Partial<ProviderProfile>) => {
    const updatedProfiles = settings.profiles.map((p) =>
      p.id === activeProfile.id ? { ...p, ...partial } : p
    );
    handleSave({ ...settings, profiles: updatedProfiles });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    chrome.runtime.sendMessage(
      { type: "TEST_CONNECTION", profileId: activeProfile.id },
      (res) => {
        setTesting(false);
        if (res?.ok) {
          setTestResult(res.message);
        } else {
          setTestResult(`Gagal: ${res?.message || "Tidak dapat terhubung"}`);
        }
      }
    );
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    chrome.runtime.sendMessage(
      { type: "LIST_MODELS", profileId: activeProfile.id },
      (models: string[] | { error: string }) => {
        setFetchingModels(false);
        if (Array.isArray(models)) {
          setAvailableModels(models);
        } else {
          alert(`Gagal mengambil model: ${models?.error || "Error tidak diketahui"}`);
        }
      }
    );
  };

  const handleClearCache = async () => {
    if (confirm("Hapus semua riwayat cache terjemahan?")) {
      await clearCache();
      const stats = await getCacheStats();
      setCacheStats(stats);
      alert("Cache berhasil dihapus.");
    }
  };

  const addAutoDomain = () => {
    const d = newAutoDomain.trim().toLowerCase();
    if (!d) return;
    const current = settings.autoTranslateDomains || [];
    if (!current.includes(d)) {
      handleSave({ ...settings, autoTranslateDomains: [...current, d] });
    }
    setNewAutoDomain("");
  };

  const removeAutoDomain = (domain: string) => {
    const current = settings.autoTranslateDomains || [];
    handleSave({
      ...settings,
      autoTranslateDomains: current.filter((d) => d !== domain),
    });
  };

  const addNeverDomain = () => {
    const d = newNeverDomain.trim().toLowerCase();
    if (!d) return;
    const current = settings.neverTranslateDomains || [];
    if (!current.includes(d)) {
      handleSave({ ...settings, neverTranslateDomains: [...current, d] });
    }
    setNewNeverDomain("");
  };

  const removeNeverDomain = (domain: string) => {
    const current = settings.neverTranslateDomains || [];
    handleSave({
      ...settings,
      neverTranslateDomains: current.filter((d) => d !== domain),
    });
  };

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "28px 18px 60px" }}>
      {/* Title Header */}
      <div
        class="nb-box nb-yellow"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              border: "3px solid #111",
              background: "#fff8ea",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "3px 3px 0 #111",
              color: "#111",
            }}
          >
            <TsuyakuLogo size={32} />
          </div>
          <div>
            <h1 class="nb-h2" style={{ fontSize: "1.7rem", letterSpacing: "-0.01em" }}>
              TSUYAKU BRIDGE
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: "0.95rem", fontWeight: 700, opacity: 0.85 }}>
              Read anything. Understand everything
            </p>
          </div>
        </div>

        {savedNotice && (
          <span
            class="nb-badge nb-teal"
            style={{
              fontSize: "0.85rem",
              padding: "6px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CheckIcon size={14} />
            <span>TERSIMPAN!</span>
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "22px" }}>
        {[
          { id: "profiles", label: "Provider AI", icon: <CpuIcon size={17} /> },
          { id: "automation", label: "Otomatisasi", icon: <BoltIcon size={17} /> },
          { id: "prompt", label: "Prompt & Glosarium", icon: <PromptIcon size={17} /> },
          { id: "cache", label: "Cache & Storage", icon: <DatabaseIcon size={17} /> },
          { id: "about", label: "Tentang", icon: <InfoIcon size={17} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            class={`nb-pill ${activeTab === tab.id ? "active" : ""}`}
            style={{
              padding: "8px 16px",
              fontSize: "0.92rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: activeTab === tab.id ? "var(--nb-yellow)" : "var(--nb-paper)",
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Provider AI */}
      {activeTab === "profiles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Profile Picker */}
          <div class="nb-box nb-teal" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label class="nb-field">PILIH PROFIL AKTIF</label>
            <select
              class="nb-select"
              value={settings.activeProfileId}
              onChange={(e) => handleSave({ ...settings, activeProfileId: (e.target as HTMLSelectElement).value })}
            >
              {settings.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.model ? `(${p.model})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Form Editor for Active Profile */}
          <div class="nb-box" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 class="nb-h3">Konfigurasi: {activeProfile.name}</h2>
              <span class="nb-badge nb-pink">OPENAI COMPATIBLE</span>
            </div>

            {/* Base URL */}
            <div class="nb-field">
              <label>Base URL (API Endpoint)</label>
              <input
                type="text"
                class="nb-input"
                value={activeProfile.baseUrl}
                onInput={(e) => updateActiveProfile({ baseUrl: (e.target as HTMLInputElement).value })}
                placeholder="http://localhost:20128/v1"
              />
              <span style={{ fontSize: "0.8rem", opacity: 0.8, textTransform: "none" }}>
                Gunakan <code>http://localhost:20128/v1</code> untuk 9router, atau <code>http://localhost:11434/v1</code> untuk Ollama.
              </span>
            </div>

            {/* API Key */}
            <div class="nb-field">
              <label>API Key (Opsional untuk server lokal)</label>
              <input
                type="password"
                class="nb-input"
                value={activeProfile.apiKey || ""}
                onInput={(e) => updateActiveProfile({ apiKey: (e.target as HTMLInputElement).value })}
                placeholder="sk-..."
              />
            </div>

            {/* Model Name & Fetch Button */}
            <div class="nb-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Nama Model / Combo</label>
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={fetchingModels}
                  class="nb-pill"
                  style={{
                    fontSize: "0.78rem",
                    padding: "3px 10px",
                    background: "var(--nb-teal)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <DownloadIcon size={14} />
                  <span>{fetchingModels ? "Mengambil..." : "Tarik Daftar Model"}</span>
                </button>
              </div>

              {availableModels.length > 0 ? (
                <select
                  class="nb-select"
                  value={activeProfile.model}
                  onChange={(e) => updateActiveProfile({ model: (e.target as HTMLSelectElement).value })}
                >
                  <option value="">Pilih model...</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  class="nb-input"
                  value={activeProfile.model}
                  onInput={(e) => updateActiveProfile({ model: (e.target as HTMLInputElement).value })}
                  placeholder="Contoh: my-combo, qwen2.5:7b, gpt-4o-mini"
                />
              )}
            </div>

            {/* Test Connection Button */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "6px" }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                class="nb-btn nb-yellow"
                style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                <BoltIcon size={16} />
                <span>{testing ? "Menguji..." : "Uji Koneksi"}</span>
              </button>
              {testResult && (
                <div
                  class={`nb-alert ${testResult.startsWith("Gagal") ? "err" : "ok"}`}
                  style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  {testResult.startsWith("Gagal") ? (
                    <CrossIcon size={14} />
                  ) : (
                    <CheckIcon size={14} />
                  )}
                  <span>{testResult}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Automation & Features */}
      {activeTab === "automation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* General Automation Switches */}
          <div class="nb-box" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 class="nb-h3">Opsi Otomatisasi & Tombol 1-Klik</h2>

            {/* Global Auto Translate Toggle */}
            <label class="nb-checkbox-row">
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                  Otomatis Terjemahkan Semua Halaman Web (Global)
                </div>
                <div style={{ fontSize: "0.82rem", opacity: 0.8, marginTop: "2px" }}>
                  Jika aktif, setiap halaman web yang dibuka akan otomatis langsung diterjemahkan tanpa perlu klik manual.
                </div>
              </div>
              <input
                type="checkbox"
                class="nb-checkbox-custom"
                checked={settings.autoTranslate}
                onChange={(e) => handleSave({ ...settings, autoTranslate: (e.target as HTMLInputElement).checked })}
              />
            </label>

            {/* Floating 1-Click Button */}
            <label class="nb-checkbox-row">
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                  Tampilkan Tombol Mengambang 1-Klik di Halaman Web
                </div>
                <div style={{ fontSize: "0.82rem", opacity: 0.8, marginTop: "2px" }}>
                  Menampilkan tombol mengambang di pojok kanan bawah halaman untuk 1-klik terjemahkan / kembalikan teks asli.
                </div>
              </div>
              <input
                type="checkbox"
                class="nb-checkbox-custom"
                checked={settings.floatingButton !== false}
                onChange={(e) => handleSave({ ...settings, floatingButton: (e.target as HTMLInputElement).checked })}
              />
            </label>

            {/* Skip if already target */}
            <label class="nb-checkbox-row">
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                  Lewati jika Halaman Sudah Sesuai Bahasa Target
                </div>
                <div style={{ fontSize: "0.82rem", opacity: 0.8, marginTop: "2px" }}>
                  Mencegah penerjemahan otomatis jika tag bahasa halaman web sudah sama dengan bahasa tujuan (menghemat token API).
                </div>
              </div>
              <input
                type="checkbox"
                class="nb-checkbox-custom"
                checked={settings.skipIfAlreadyTarget}
                onChange={(e) => handleSave({ ...settings, skipIfAlreadyTarget: (e.target as HTMLInputElement).checked })}
              />
            </label>

            {/* Delay before auto translate */}
            <div class="nb-field" style={{ marginTop: "6px" }}>
              <label>Jeda Waktu Sebelum Terjemahan Otomatis (milidetik)</label>
              <input
                type="number"
                min="200"
                max="5000"
                step="100"
                class="nb-input"
                style={{ width: "160px" }}
                value={settings.autoTranslateDelayMs || 800}
                onInput={(e) =>
                  handleSave({
                    ...settings,
                    autoTranslateDelayMs: parseInt((e.target as HTMLInputElement).value, 10) || 800,
                  })
                }
              />
              <span style={{ fontSize: "0.8rem", opacity: 0.8, textTransform: "none" }}>
                Memberikan waktu bagi elemen dinamis website untuk selesai dimuat sebelum teks diekstrak (rekomendasi: 800ms).
              </span>
            </div>
          </div>

          {/* Whitelist Domains */}
          <div class="nb-box" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 class="nb-h3">Domain yang Selalu Diterjemahkan Otomatis (Whitelist)</h2>
            <p style={{ fontSize: "0.88rem", margin: 0, opacity: 0.9 }}>
              Jika opsi global di atas tidak aktif, ekstensi hanya akan otomatis menerjemahkan website pada daftar domain berikut:
            </p>

            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                class="nb-input"
                placeholder="misal: wikipedia.org, github.com"
                value={newAutoDomain}
                onInput={(e) => setNewAutoDomain((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => e.key === "Enter" && addAutoDomain()}
                style={{ flex: 1 }}
              />
              <button
                onClick={addAutoDomain}
                class="nb-btn nb-teal"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <PlusIcon size={15} />
                <span>Tambah</span>
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {(settings.autoTranslateDomains || []).length === 0 ? (
                <span style={{ fontSize: "0.85rem", opacity: 0.7, fontStyle: "italic" }}>
                  Belum ada domain whitelist. Anda juga bisa menambahkannya langsung dari Popup ekstensi.
                </span>
              ) : (
                settings.autoTranslateDomains.map((domain) => (
                  <span key={domain} class="nb-pill nb-yellow">
                    {domain}
                    <button
                      onClick={() => removeAutoDomain(domain)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--nb-red)",
                        cursor: "pointer",
                        fontWeight: 900,
                        fontSize: "14px",
                        padding: "0 0 0 6px",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                      title="Hapus domain"
                    >
                      <CrossIcon size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Blacklist Domains */}
          <div class="nb-box" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 class="nb-h3">Domain yang Tidak Pernah Diterjemahkan (Blacklist)</h2>
            <p style={{ fontSize: "0.88rem", margin: 0, opacity: 0.9 }}>
              Website dalam daftar ini tidak akan pernah diterjemahkan secara otomatis:
            </p>

            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                class="nb-input"
                placeholder="misal: bank.com, localhost"
                value={newNeverDomain}
                onInput={(e) => setNewNeverDomain((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => e.key === "Enter" && addNeverDomain()}
                style={{ flex: 1 }}
              />
              <button
                onClick={addNeverDomain}
                class="nb-btn nb-orange"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <PlusIcon size={15} />
                <span>Tambah</span>
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {(settings.neverTranslateDomains || []).length === 0 ? (
                <span style={{ fontSize: "0.85rem", opacity: 0.7, fontStyle: "italic" }}>
                  Belum ada domain blacklist.
                </span>
              ) : (
                settings.neverTranslateDomains.map((domain) => (
                  <span key={domain} class="nb-pill nb-pink">
                    {domain}
                    <button
                      onClick={() => removeNeverDomain(domain)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--nb-red)",
                        cursor: "pointer",
                        fontWeight: 900,
                        fontSize: "14px",
                        padding: "0 0 0 6px",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                      title="Hapus domain"
                    >
                      <CrossIcon size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Prompt & Glosarium */}
      {activeTab === "prompt" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div class="nb-box" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label class="nb-field">TEMPLATE SYSTEM PROMPT</label>
            <textarea
              class="nb-textarea"
              rows={6}
              value={settings.systemPromptTemplate}
              onInput={(e) =>
                handleSave({ ...settings, systemPromptTemplate: (e.target as HTMLTextAreaElement).value })
              }
              placeholder="Kosongkan untuk menggunakan prompt sistem default bawaan yang sudah dioptimasi."
              style={{ fontFamily: "monospace", fontSize: "0.88rem" }}
            />
            <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
              Variabel yang didukung: <code>&#123;target&#125;</code>, <code>&#123;source&#125;</code>, <code>&#123;glossary&#125;</code>
            </span>
          </div>
        </div>
      )}

      {/* Tab: Cache */}
      {activeTab === "cache" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div class="nb-box" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 class="nb-h3">Statistik Cache IndexedDB</h2>
              <span class="nb-badge nb-teal">LOKAL & CEPAT</span>
            </div>
            <div class="nb-stat" style={{ fontSize: "2.4rem", color: "var(--nb-ink)" }}>
              {cacheStats.count} <span style={{ fontSize: "1rem", fontFamily: "var(--nb-font-body)" }}>item tersimpan</span>
            </div>
            <p style={{ fontSize: "0.95rem", margin: 0, opacity: 0.85 }}>
              Estimasi ukuran cache: <b>{(cacheStats.totalChars / 1024).toFixed(1)} KB</b>.
              Cache mempercepat penerjemahan ulang halaman tanpa memakan kuota token AI Anda.
            </p>
            <div>
              <button
                type="button"
                onClick={handleClearCache}
                class="nb-btn nb-red"
                style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                <TrashIcon size={16} />
                <span>Hapus Semua Cache</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: About */}
      {activeTab === "about" && (
        <div class="nb-box nb-paper" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span class="nb-badge nb-yellow" style={{ fontSize: "0.85rem" }}>
              VERSI 0.1.0
            </span>
            <span class="nb-pill">MANIFEST V3</span>
          </div>
          <h2 class="nb-h2" style={{ fontSize: "1.8rem" }}>
            TSUYAKU BRIDGE
          </h2>
          <p style={{ fontSize: "1.05rem", fontWeight: 700, margin: "-4px 0 0", color: "var(--nb-ink)" }}>
            Read anything. Understand everything
          </p>
          <p style={{ fontSize: "0.95rem", lineHeight: "1.6", margin: 0 }}>
            Ekstensi peramban berbasis Manifest V3 untuk menerjemahkan halaman web dengan kontrol penuh atas model AI.
            Didesain dengan estetika <b>Neo-Brutalism</b> yang kontras, responsif, dan tanpa ketergantungan emoji bawaan OS.
            Mendukung 9router, Ollama, LM Studio, OpenAI, dan berbagai penyedia OpenAI-compatible lainnya.
          </p>
        </div>
      )}
    </div>
  );
}
