import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import * as esbuild from "esbuild";

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

// 2. Bundle content script & background script sebagai standalone IIFE untuk Firefox
// Firefox tidak mengizinkan dynamic import ES module di content script halaman web
console.log("-> Bundling content & background scripts untuk Firefox (format: IIFE)...");

esbuild.buildSync({
  entryPoints: [path.join(rootDir, "src/content/index.ts")],
  outfile: path.join(firefoxDistDir, "content.bundle.js"),
  bundle: true,
  format: "iife",
  target: "firefox109",
});

esbuild.buildSync({
  entryPoints: [path.join(rootDir, "src/background/index.ts")],
  outfile: path.join(firefoxDistDir, "background.bundle.js"),
  bundle: true,
  format: "iife",
  target: "firefox109",
});

// 3. Modifikasi manifest.json untuk kompatibilitas Firefox MV3 murni
const manifestPath = path.join(firefoxDistDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

// Background script: Gunakan background.scripts IIFE (bukan service_worker)
manifest.background = {
  scripts: ["background.bundle.js"],
};

// Content script: Gunakan content.bundle.js langsung (tanpa loader / dynamic import)
if (manifest.content_scripts && manifest.content_scripts.length > 0) {
  manifest.content_scripts[0].js = ["content.bundle.js"];
}

// Hapus use_dynamic_url karena Firefox tidak mendukung properti ini
if (manifest.web_accessible_resources) {
  for (const war of manifest.web_accessible_resources) {
    delete war.use_dynamic_url;
  }
}

// Gecko ID untuk Firefox MV3
manifest.browser_specific_settings = manifest.browser_specific_settings || {};
manifest.browser_specific_settings.gecko = {
  id: "ai-page-translator@antigravity",
  strict_min_version: "109.0",
  ...manifest.browser_specific_settings.gecko,
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
console.log("✓ Manifest dan bundle disesuaikan untuk Firefox MV3.");

// 4. Hapus file arsip lama jika ada
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
if (fs.existsSync(xpiPath)) fs.unlinkSync(xpiPath);

// 5. Buat file .zip menggunakan PowerShell lalu duplikasi ke .xpi
try {
  const psCommand = `$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path '${firefoxDistDir}/*' -DestinationPath '${zipPath}' -Force`;
  execSync(`powershell -NoProfile -Command "${psCommand}"`, { stdio: "inherit" });
  fs.copyFileSync(zipPath, xpiPath);
  console.log(`✓ Berhasil membuat file .xpi: ${xpiPath}`);
  console.log(`✓ Berhasil membuat file .zip: ${zipPath}`);
} catch (err) {
  console.error("Gagal membuat file paket Firefox:", err);
  process.exit(1);
}
