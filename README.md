# 🌉 Tsuyaku Bridge
> **Read anything. Understand everything.**

Ekstensi Chrome modern berbasis **Manifest V3** untuk menerjemahkan seluruh halaman web dengan kontrol penuh atas model AI. Didesain dengan estetika **Neo-Brutalism** yang tegas, kontras tinggi, dan responsif tanpa ketergantungan emoji bawaan sistem.

---

## ✨ Fitur Utama

- 🎨 **Neo-Brutalism UI Kit**: Tampilan kontras tinggi dengan garis tegas, bayangan solid, dan ikon SVG kustom.
- 🤖 **Multi-Provider AI**: Kompatibel dengan semua endpoint OpenAI-compatible (`9router`, `Ollama`, `LM Studio`, `OpenAI`, dll).
- 📖 **Mode Terjemahan Fleksibel**:
  - **Bilingual**: Mempertahankan teks asli dengan terjemahan di bawahnya.
  - **Ganti Teks (Replace)**: Mengganti teks asli langsung di DOM web.
- ⚡ **Otomatisasi Cerdas**:
  - Terjemah otomatis global atau berbasis whitelist domain (contoh: `wikipedia.org`, `github.com`).
  - Blacklist domain untuk mencegah penerjemahan di situs tertentu (contoh: internet banking).
  - Melewati halaman jika tag bahasa sudah sesuai dengan target.
- 🖱️ **Tombol Mengambang 1-Klik**: Tombol akses cepat di pojok halaman untuk menerjemahkan atau mengembalikan teks asli secara instan.
- 💾 **Local Cache (IndexedDB)**: Menghemat kuota token AI dan mempercepat reload terjemahan.

---

## 🚀 Memulai (Development)

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18+)
- Google Chrome atau browser berbasis Chromium

### Instalasi & Build
```bash
# Clone repository
git clone https://github.com/<username>/tsuyaku-bridge.git
cd tsuyaku-bridge

# Install dependencies
npm install

# Build ekstensi
npm run build

# Menjalankan unit tests
npm test
```

### Memuat Ekstensi di Chrome
1. Buka browser Chrome dan akses `chrome://extensions/`.
2. Aktifkan **Developer mode** di pojok kanan atas.
3. Klik tombol **Load unpacked**.
4. Pilih folder `dist/` dari proyek ini.

---

## 🛠️ Stack Teknologi

- **Framework**: [Preact](https://preactjs.com/)
- **Bundler**: [Vite](https://vitejs.dev/) + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)
- **Styling**: Vanilla CSS (Neo-Brutalism Design Kit)
- **Database**: IndexedDB (`idb`)
- **Testing**: [Vitest](https://vitest.dev/)
- **Language**: TypeScript

---

## 📄 Lisensi
MIT License
