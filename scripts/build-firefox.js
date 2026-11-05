import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const firefoxDistDir = path.join(rootDir, "dist-firefox");
const zipPath = path.join(rootDir, "tsuyaku-bridge.zip");
const xpiPath = path.join(rootDir, "tsuyaku-bridge.xpi");

if (!fs.existsSync(distDir)) {
  console.error("Error: Folder dist belum ada. Jalankan 'npm run build' terlebih dahulu.");
  process.exit(1);
}

// 1. Bersihkan & salin dist ke dist-firefox
if (fs.existsSync(firefoxDistDir)) {
  fs.rmSync(firefoxDistDir, { recursive: true, force: true });
}
fs.cpSync(distDir, firefoxDistDir, { recursive: true });

// 2. Modifikasi manifest.json untuk kompatibilitas Firefox MV3
const manifestPath = path.join(firefoxDistDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

// Firefox MV3 membutuhkan background.scripts (Event Page)
if (manifest.background) {
  const workerFile = manifest.background.service_worker || "service-worker-loader.js";
  manifest.background = {
    ...manifest.background,
    scripts: [workerFile],
    type: "module",
  };
}

// Pastikan browser_specific_settings tersedia
manifest.browser_specific_settings = manifest.browser_specific_settings || {};
manifest.browser_specific_settings.gecko = {
  id: "ai-page-translator@antigravity",
  strict_min_version: "109.0",
  ...manifest.browser_specific_settings.gecko,
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
console.log("✓ Manifest disesuaikan untuk Firefox (background.scripts & gecko ID disiapkan).");

// 3. Hapus file lama jika ada
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
if (fs.existsSync(xpiPath)) fs.unlinkSync(xpiPath);

// 4. Buat file .zip menggunakan PowerShell lalu duplikasi ke .xpi
try {
  const psCommand = `Compress-Archive -Path "${firefoxDistDir}/*" -DestinationPath "${zipPath}" -Force`;
  execSync(`powershell -NoProfile -Command "${psCommand}"`, { stdio: "inherit" });
  fs.copyFileSync(zipPath, xpiPath);
  console.log(`✓ Berhasil membuat file .xpi: ${xpiPath}`);
  console.log(`✓ Berhasil membuat file .zip: ${zipPath}`);
} catch (err) {
  console.error("Gagal membuat file paket Firefox:", err);
  process.exit(1);
}
